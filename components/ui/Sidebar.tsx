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
  Target, Bot, Settings, Building2, Check, ChevronsUpDown, FileDown, PiggyBank,
} from 'lucide-react'
import { supabase } from '@/lib/supabase/client'
import { useWorkspace } from '@/contexts/WorkspaceContext'
import { usePermissions, type PermissionKey } from '@/contexts/PermissionsContext'
import { cn } from '@/lib/utils'

const STORAGE_KEY        = 'senda-sidebar-collapsed'
const GROUPS_STORAGE_KEY = 'senda-sidebar-groups'

type NavItem  = { href: string; label: string; icon: React.ElementType; perm?: PermissionKey | PermissionKey[] }
type NavGroup = { id: string; label: string; items: NavItem[] }

const NAV_GROUPS: NavGroup[] = [
  {
    id: 'principal',
    label: 'Principal',
    items: [
      { href: '/',           label: 'Dashboard',  icon: LayoutDashboard },
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
      { href: '/renovaciones', label: 'Renovaciones', icon: Bell,          perm: 'polizas_ver' },
    ],
  },
  {
    id: 'finanzas',
    label: 'Finanzas',
    items: [
      { href: '/cobros',        label: 'Cobros',        icon: DollarSign,  perm: 'finanzas_cobros_ver' },
      { href: '/cartera',       label: 'Cartera',       icon: PiggyBank,   perm: 'finanzas_cobros_ver' },
      { href: '/caja',          label: 'Caja',          icon: Receipt,     perm: ['finanzas_caja_ver_propias', 'finanzas_caja_ver_todas'] },
      { href: '/liquidaciones', label: 'Liquidaciones', icon: Calculator,  perm: 'finanzas_liquidaciones_ver' },
      { href: '/colillas',      label: 'Colillas',      icon: FileDown },
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

  const [collapsed, setCollapsed]   = useState(false)
  const [mounted, setMounted]       = useState(false)
  const [wsMenuOpen, setWsMenuOpen] = useState(false)
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    principal: true, polizas: true, finanzas: true, gestion: true, crm: true,
  })

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

  useEffect(() => {
    const savedCollapsed = localStorage.getItem(STORAGE_KEY)
    if (savedCollapsed === 'true') setCollapsed(true)
    const savedGroups = localStorage.getItem(GROUPS_STORAGE_KEY)
    if (savedGroups) { try { setOpenGroups(JSON.parse(savedGroups)) } catch {} }
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
    return <aside className="w-[260px] flex-shrink-0 bg-cream-50" />
  }

  return (
    <aside
      className={cn(
        'flex-shrink-0 flex flex-col h-full bg-cream-50 border-r border-cream-200/80',
        'transition-[width] motion-reduce:transition-none duration-[220ms] ease-out',
        collapsed ? 'w-[72px]' : 'w-[260px]',
      )}
    >
      {/* ── Header ─────────────────────────────────────────── */}
      <div className="flex-shrink-0 px-4 pt-5 pb-4">
        <div className="flex items-center gap-2.5">
          {!collapsed && (
            <>
              <div className="w-9 h-9 bg-ink-700 rounded-xl flex items-center justify-center shadow-soft">
                <Shield className="w-4 h-4 text-primary-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm text-ink-700 leading-none tracking-tight">SENDA</p>
                <p className="text-[10px] text-ink-400 uppercase tracking-widest mt-1">Seguros · CRM</p>
              </div>
            </>
          )}
          <button
            onClick={toggle}
            aria-label={collapsed ? 'Expandir menú' : 'Colapsar menú'}
            className={cn(
              'flex items-center justify-center rounded-lg flex-shrink-0 w-8 h-8',
              'text-ink-400 hover:text-ink-700 hover:bg-cream-200/60',
              'transition-colors duration-150',
              collapsed && 'mx-auto',
            )}
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* ── Workspace switcher ──────────────────────────────── */}
      {!collapsed && currentWorkspace && (
        <div className="relative px-3 pb-3">
          <button
            onClick={() => setWsMenuOpen(v => !v)}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-white border border-cream-300 hover:border-primary-300 hover:shadow-card transition-all text-left shadow-card"
          >
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center flex-shrink-0 shadow-soft">
              <Building2 className="w-4 h-4 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-ink-700 truncate leading-tight">{currentWorkspace.name}</p>
              <p className="text-[10px] text-ink-400 capitalize mt-0.5 font-medium">{currentRole}</p>
            </div>
            <ChevronsUpDown className="w-3.5 h-3.5 text-ink-500 flex-shrink-0" />
          </button>

          {wsMenuOpen && workspaces.length > 1 && (
            <div className="absolute left-3 right-3 top-full mt-1 bg-white border border-cream-200 rounded-2xl shadow-lifted z-50 py-1.5 overflow-hidden">
              <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-ink-400">
                Mis workspaces
              </p>
              {workspaces.map(ws => (
                <button
                  key={ws.id}
                  onClick={() => { setCurrentWorkspace(ws); setWsMenuOpen(false) }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-cream-100 transition-colors text-left"
                >
                  <div className="w-5 h-5 rounded bg-primary-500/80 flex items-center justify-center flex-shrink-0">
                    <Building2 className="w-3 h-3 text-white" />
                  </div>
                  <span className="flex-1 text-xs text-ink-700 truncate">{ws.name}</span>
                  {ws.id === currentWorkspace.id && (
                    <Check className="w-3.5 h-3.5 text-primary-700 flex-shrink-0" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {collapsed && currentWorkspace && (
        <div className="px-4 pb-3 flex justify-center">
          <div title={currentWorkspace.name} className="w-9 h-9 rounded-xl bg-primary-500 flex items-center justify-center">
            <Building2 className="w-4 h-4 text-white" />
          </div>
        </div>
      )}

      {/* ── Navigation ──────────────────────────────────────── */}
      <nav className="flex-1 overflow-y-auto scrollbar-thin px-3 pb-3 space-y-4" aria-label="Navegación principal">
        {visibleGroups().map(group => {
          const isOpen = openGroups[group.id] ?? true
          const hasActive = group.items.some(item =>
            item.href === '/' ? pathname === '/' : pathname.startsWith(item.href)
          )

          return (
            <div key={group.id}>
              {!collapsed && (
                <button
                  onClick={() => toggleGroup(group.id)}
                  className="w-full flex items-center justify-between px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-ink-400 hover:text-ink-600 transition-colors"
                >
                  <span className="flex items-center gap-1.5">
                    {hasActive && !isOpen && (
                      <span className="w-1.5 h-1.5 rounded-full bg-primary-500 flex-shrink-0" />
                    )}
                    {group.label}
                  </span>
                  <ChevronDown className={cn('w-3 h-3 transition-transform duration-150', !isOpen && '-rotate-90')} />
                </button>
              )}

              {(isOpen || collapsed) && (
                <div className="space-y-0.5">
                  {group.items.map(({ href, label, icon: Icon }) => {
                    const active = href === '/' ? pathname === '/' : pathname.startsWith(href)
                    return (
                      <div key={href} className="relative group">
                        <Link
                          href={href}
                          aria-label={collapsed ? label : undefined}
                          aria-current={active ? 'page' : undefined}
                          className={cn(
                            'flex items-center rounded-xl text-sm font-medium min-h-[42px] relative',
                            'transition-all duration-150',
                            collapsed ? 'justify-center px-2 mx-auto w-11' : 'gap-3 px-3',
                            active
                              ? 'bg-white text-ink-700 shadow-card border border-cream-200/80 font-semibold'
                              : 'text-ink-500 hover:text-ink-700 hover:bg-ink-100/70',
                          )}
                        >
                          {active && !collapsed && (
                            <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-primary-500 rounded-r-pill" />
                          )}
                          <Icon className={cn('w-4 h-4 flex-shrink-0', active ? 'text-primary-600' : 'text-ink-400')} />
                          {!collapsed && <span className="whitespace-nowrap overflow-hidden text-sm">{label}</span>}
                        </Link>

                        {collapsed && (
                          <div
                            role="tooltip"
                            className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-2 z-50 bg-ink-700 text-white text-xs font-medium px-2.5 py-1.5 rounded-lg shadow-card whitespace-nowrap opacity-0 translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-[opacity,transform] duration-150"
                          >
                            {label}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </nav>

      {/* ── Footer ─────────────────────────────────────────── */}
      <div className="border-t border-cream-200 px-3 py-3 space-y-0.5">
        <div className="relative group">
          <Link
            href="/configuracion"
            aria-label={collapsed ? 'Configuración' : undefined}
            aria-current={pathname === '/configuracion' ? 'page' : undefined}
            className={cn(
              'flex items-center rounded-xl text-sm font-medium min-h-[40px]',
              'transition-colors duration-150',
              collapsed ? 'justify-center px-2 mx-auto w-11' : 'gap-3 px-3',
              pathname === '/configuracion'
                ? 'bg-white text-ink-700 shadow-soft'
                : 'text-ink-500 hover:text-ink-700 hover:bg-ink-100/70',
            )}
          >
            <Settings className={cn('w-4 h-4 flex-shrink-0', pathname === '/configuracion' && 'text-primary-700')} />
            {!collapsed && <span className="text-sm">Configuración</span>}
          </Link>
        </div>

        <button
          onClick={handleLogout}
          aria-label="Cerrar sesión"
          className={cn(
            'w-full flex items-center rounded-xl text-sm font-medium min-h-[40px]',
            'transition-colors duration-150',
            collapsed ? 'justify-center px-2 mx-auto w-11' : 'gap-3 px-3',
            'text-ink-400 hover:text-error hover:bg-error-soft/40',
          )}
        >
          <LogOut className="w-4 h-4 flex-shrink-0" />
          {!collapsed && <span className="text-sm">Cerrar sesión</span>}
        </button>
      </div>
    </aside>
  )
}
