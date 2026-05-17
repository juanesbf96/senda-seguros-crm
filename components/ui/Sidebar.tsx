'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import {
  LayoutDashboard, Users, FileText, Kanban,
  Bell, Shield, ChevronLeft, ChevronRight, ChevronDown,
  LogOut, ClipboardList, CheckSquare, Send,
  DollarSign, Receipt, UserCog, Calculator, TrendingUp, CalendarDays,
  BarChart2, FolderOpen, ShieldAlert, FileSpreadsheet, ClipboardCheck,
  Target, Bot, Settings, Building2, Check, ChevronsUpDown, FlaskConical,
} from 'lucide-react'
import { supabase } from '@/lib/supabase/client'
import { useWorkspace } from '@/contexts/WorkspaceContext'
import { usePermissions, type PermissionKey } from '@/contexts/PermissionsContext'

const STORAGE_KEY       = 'senda-sidebar-collapsed'
const GROUPS_STORAGE_KEY = 'senda-sidebar-groups'

type NavItem = { href: string; label: string; icon: React.ElementType; perm?: PermissionKey | PermissionKey[] }
type NavGroup = { id: string; label: string; items: NavItem[] }

const NAV_GROUPS: NavGroup[] = [
  {
    id: 'principal',
    label: 'Principal',
    items: [
      { href: '/',           label: 'Dashboard',  icon: LayoutDashboard },
      { href: '/testeo123',   label: 'testeo123',  icon: FlaskConical },
      { href: '/asistente',  label: 'Asistente',  icon: Bot },
      { href: '/leads',      label: 'Pipeline',   icon: Kanban,  perm: 'pipeline_ver' },
      { href: '/clientes',   label: 'Clientes',   icon: Users,   perm: 'clientes_ver_todos' },
    ],
  },
  {
    id: 'polizas',
    label: 'Pólizas',
    items: [
      { href: '/polizas',      label: 'Pólizas',      icon: FileText,      perm: 'polizas_ver' },
      { href: '/solicitudes',  label: 'Solicitudes',  icon: ClipboardList, perm: 'solicitudes_ver' },
      { href: '/remisiones',   label: 'Remisiones',   icon: Send },
      { href: '/renovaciones', label: 'Renovaciones', icon: Bell,          perm: 'polizas_ver' },
    ],
  },
  {
    id: 'finanzas',
    label: 'Finanzas',
    items: [
      { href: '/cobros',        label: 'Cobros',        icon: DollarSign,  perm: 'finanzas_cobros_ver' },
      { href: '/caja',          label: 'Caja',          icon: Receipt,     perm: ['finanzas_caja_ver_propias', 'finanzas_caja_ver_todas'] },
      { href: '/liquidaciones', label: 'Liquidaciones', icon: Calculator,  perm: 'finanzas_liquidaciones_ver' },
    ],
  },
  {
    id: 'gestion',
    label: 'Gestión',
    items: [
      { href: '/agenda',     label: 'Agenda',     icon: CalendarDays },
      { href: '/tareas',     label: 'Tareas',     icon: CheckSquare, perm: 'tareas_ver_todas' },
      { href: '/metas',      label: 'Metas',      icon: Target,      perm: 'metas_ver' },
      { href: '/vendedores', label: 'Vendedores', icon: UserCog },
    ],
  },
  {
    id: 'crm',
    label: 'CRM',
    items: [
      { href: '/prospectos', label: 'Prospectos', icon: TrendingUp, perm: 'pipeline_ver' },
    ],
  },
  {
    id: 'operaciones',
    label: 'Operaciones',
    items: [
      { href: '/siniestros',  label: 'Siniestros',  icon: ShieldAlert,    perm: 'siniestros_ver' },
      { href: '/facturas',    label: 'Facturas',    icon: FileSpreadsheet },
      { href: '/diligencias', label: 'Diligencias', icon: ClipboardCheck },
    ],
  },
  {
    id: 'reportes',
    label: 'Reportes',
    items: [
      { href: '/informes', label: 'Informes', icon: BarChart2 },
      { href: '/archivos', label: 'Archivos', icon: FolderOpen },
    ],
  },
]

export default function Sidebar() {
  const pathname = usePathname()
  const router   = useRouter()
  const { workspaces, currentWorkspace, currentRole, setCurrentWorkspace } = useWorkspace()
  const { can } = usePermissions()

  // Filter nav items by permission
  function visibleGroups(): NavGroup[] {
    return NAV_GROUPS.map(group => ({
      ...group,
      items: group.items.filter(item => {
        if (!item.perm) return true
        if (Array.isArray(item.perm)) return item.perm.some(p => can(p))
        return can(item.perm)
      }),
    })).filter(group => group.items.length > 0)
  }
  const [collapsed, setCollapsed]   = useState(false)
  const [mounted, setMounted]       = useState(false)
  const [wsMenuOpen, setWsMenuOpen] = useState(false)
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
      <div className="flex-shrink-0 border-b border-slate-700">
        <div className="h-[60px] flex items-center px-2.5 gap-2 overflow-hidden">
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

        {/* Workspace switcher */}
        {!collapsed && currentWorkspace && (
          <div className="relative px-2 pb-2">
            <button
              onClick={() => setWsMenuOpen(v => !v)}
              className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 transition-colors text-left"
            >
              <div className="w-6 h-6 rounded-md bg-emerald-600 flex items-center justify-center flex-shrink-0">
                <Building2 className="w-3.5 h-3.5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-white truncate leading-tight">{currentWorkspace.name}</p>
                <p className="text-[10px] text-slate-400 capitalize">{currentRole}</p>
              </div>
              <ChevronsUpDown className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
            </button>

            {wsMenuOpen && workspaces.length > 1 && (
              <div className="absolute left-2 right-2 top-full mt-1 bg-slate-800 border border-slate-600 rounded-xl shadow-xl z-50 py-1 overflow-hidden">
                <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  Mis workspaces
                </p>
                {workspaces.map(ws => (
                  <button
                    key={ws.id}
                    onClick={() => { setCurrentWorkspace(ws); setWsMenuOpen(false) }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-slate-700 transition-colors text-left"
                  >
                    <div className="w-5 h-5 rounded bg-emerald-600/80 flex items-center justify-center flex-shrink-0">
                      <Building2 className="w-3 h-3 text-white" />
                    </div>
                    <span className="flex-1 text-xs text-slate-200 truncate">{ws.name}</span>
                    {ws.id === currentWorkspace.id && (
                      <Check className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {collapsed && currentWorkspace && (
          <div className="px-2 pb-2 flex justify-center">
            <div title={currentWorkspace.name} className="w-8 h-8 rounded-md bg-emerald-600 flex items-center justify-center">
              <Building2 className="w-4 h-4 text-white" />
            </div>
          </div>
        )}
      </div>

      {/* ── Navigation ──────────────────────────────────────── */}
      <nav className="flex-1 overflow-y-auto py-2" aria-label="Navegación principal">
        {visibleGroups().map(group => {
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
        {/* Configuración */}
        <div className="relative group">
          <Link
            href="/configuracion"
            aria-label={collapsed ? 'Configuración' : undefined}
            aria-current={pathname === '/configuracion' ? 'page' : undefined}
            className={[
              'flex items-center rounded-lg text-sm font-medium min-h-[38px]',
              'transition-colors duration-150',
              'focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-1 focus:ring-offset-slate-900',
              collapsed ? 'justify-center px-2' : 'gap-3 px-3',
              pathname === '/configuracion'
                ? 'bg-emerald-600 text-white'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white',
            ].join(' ')}
          >
            <Settings className="w-4 h-4 flex-shrink-0" />
            {!collapsed && <span className="whitespace-nowrap overflow-hidden text-sm">Configuración</span>}
          </Link>
          {collapsed && (
            <div role="tooltip" className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-3 z-50 bg-slate-800 border border-slate-600 text-white text-xs font-medium px-2.5 py-1.5 rounded-lg shadow-xl whitespace-nowrap opacity-0 translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-[opacity,transform] duration-150 ease-out">
              <span className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-slate-600" />
              Configuración
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
