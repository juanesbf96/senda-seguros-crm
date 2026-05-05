'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import {
  LayoutDashboard, Users, FileText, Kanban,
  Bell, Shield, ChevronLeft, ChevronRight,
  User, LogOut,
} from 'lucide-react'
import { supabase } from '@/lib/supabase/client'

const STORAGE_KEY = 'senda-sidebar-collapsed'

const navItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/leads', label: 'Pipeline', icon: Kanban },
  { href: '/clientes', label: 'Clientes', icon: Users },
  { href: '/polizas', label: 'Pólizas', icon: FileText },
  { href: '/renovaciones', label: 'Renovaciones', icon: Bell },
]

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const [collapsed, setCollapsed] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [userName, setUserName] = useState('')

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'true') setCollapsed(true)
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
          aria-expanded={!collapsed}
          aria-label={collapsed ? 'Expandir menú lateral' : 'Colapsar menú lateral'}
          className={[
            'flex items-center justify-center rounded-lg flex-shrink-0',
            'w-9 h-9',
            'text-slate-400 hover:text-white hover:bg-slate-700 active:bg-slate-600',
            'transition-colors duration-150',
            'focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-1 focus:ring-offset-slate-900',
            collapsed ? 'mx-auto' : '',
          ].join(' ')}
        >
          {collapsed
            ? <ChevronRight className="w-4 h-4" />
            : <ChevronLeft className="w-4 h-4" />
          }
        </button>
      </div>

      {/* ── Navigation ──────────────────────────────────────── */}
      <nav
        className="flex-1 px-2 py-3 space-y-0.5 overflow-hidden"
        aria-label="Navegación principal"
      >
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== '/' && pathname.startsWith(href))
          return (
            <div key={href} className="relative group">
              <Link
                href={href}
                aria-label={collapsed ? label : undefined}
                aria-current={active ? 'page' : undefined}
                className={[
                  'flex items-center rounded-lg text-sm font-medium min-h-[44px]',
                  'transition-colors duration-150',
                  'focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-1 focus:ring-offset-slate-900',
                  collapsed ? 'justify-center px-2' : 'gap-3 px-3',
                  active
                    ? 'bg-emerald-600 text-white'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white',
                ].join(' ')}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                {!collapsed && (
                  <span className="whitespace-nowrap overflow-hidden">{label}</span>
                )}
                {active && collapsed && (
                  <span
                    aria-hidden="true"
                    className="absolute right-1 top-1/2 -translate-y-1/2 w-1 h-5 bg-emerald-400 rounded-full"
                  />
                )}
              </Link>
              {collapsed && (
                <div
                  role="tooltip"
                  className={[
                    'pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-3 z-50',
                    'bg-slate-800 border border-slate-600 text-white text-xs font-medium',
                    'px-2.5 py-1.5 rounded-lg shadow-xl whitespace-nowrap',
                    'opacity-0 translate-x-1',
                    'group-hover:opacity-100 group-hover:translate-x-0',
                    'transition-[opacity,transform] duration-150 ease-out motion-reduce:transition-none',
                  ].join(' ')}
                >
                  <span
                    aria-hidden="true"
                    className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-slate-600"
                  />
                  {label}
                </div>
              )}
            </div>
          )
        })}
      </nav>

      {/* ── User / Footer ────────────────────────────────────── */}
      <div className="border-t border-slate-700 px-2 py-2 space-y-0.5">
        {/* Perfil */}
        <div className="relative group">
          <Link
            href="/perfil"
            aria-label={collapsed ? 'Mi perfil' : undefined}
            aria-current={pathname === '/perfil' ? 'page' : undefined}
            className={[
              'flex items-center rounded-lg text-sm font-medium min-h-[44px]',
              'transition-colors duration-150',
              'focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-1 focus:ring-offset-slate-900',
              collapsed ? 'justify-center px-2' : 'gap-3 px-3',
              pathname === '/perfil'
                ? 'bg-emerald-600 text-white'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white',
            ].join(' ')}
          >
            <User className="w-5 h-5 flex-shrink-0" />
            {!collapsed && (
              <span className="whitespace-nowrap overflow-hidden truncate">
                {userName || 'Mi perfil'}
              </span>
            )}
          </Link>
          {collapsed && (
            <div
              role="tooltip"
              className={[
                'pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-3 z-50',
                'bg-slate-800 border border-slate-600 text-white text-xs font-medium',
                'px-2.5 py-1.5 rounded-lg shadow-xl whitespace-nowrap',
                'opacity-0 translate-x-1',
                'group-hover:opacity-100 group-hover:translate-x-0',
                'transition-[opacity,transform] duration-150 ease-out motion-reduce:transition-none',
              ].join(' ')}
            >
              <span
                aria-hidden="true"
                className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-slate-600"
              />
              {userName || 'Mi perfil'}
            </div>
          )}
        </div>

        {/* Cerrar sesión */}
        <div className="relative group">
          <button
            onClick={handleLogout}
            aria-label="Cerrar sesión"
            className={[
              'w-full flex items-center rounded-lg text-sm font-medium min-h-[44px]',
              'transition-colors duration-150',
              'focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-1 focus:ring-offset-slate-900',
              collapsed ? 'justify-center px-2' : 'gap-3 px-3',
              'text-slate-400 hover:bg-slate-800 hover:text-red-400',
            ].join(' ')}
          >
            <LogOut className="w-5 h-5 flex-shrink-0" />
            {!collapsed && <span className="whitespace-nowrap">Cerrar sesión</span>}
          </button>
          {collapsed && (
            <div
              role="tooltip"
              className={[
                'pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-3 z-50',
                'bg-slate-800 border border-slate-600 text-white text-xs font-medium',
                'px-2.5 py-1.5 rounded-lg shadow-xl whitespace-nowrap',
                'opacity-0 translate-x-1',
                'group-hover:opacity-100 group-hover:translate-x-0',
                'transition-[opacity,transform] duration-150 ease-out motion-reduce:transition-none',
              ].join(' ')}
            >
              <span
                aria-hidden="true"
                className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-slate-600"
              />
              Cerrar sesión
            </div>
          )}
        </div>
      </div>
    </aside>
  )
}
