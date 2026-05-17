'use client'
import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react'
import { supabase } from '@/lib/supabase/client'

export type WorkspaceRole = 'admin' | 'supervisor' | 'agente'

export interface Workspace {
  id: string
  name: string
  owner_id: string | null
  slug: string | null
  setup_completed: boolean
  created_at: string
}

interface WorkspaceContextType {
  workspaces: Workspace[]
  currentWorkspace: Workspace | null
  currentRole: WorkspaceRole | null
  currentUserId: string | null
  loading: boolean
  setCurrentWorkspace: (ws: Workspace) => void
  refreshWorkspaces: () => Promise<void>
  isAdmin: boolean
  isSupervisor: boolean  // true para admin Y supervisor
}

const WorkspaceContext = createContext<WorkspaceContextType>({
  workspaces: [],
  currentWorkspace: null,
  currentRole: null,
  currentUserId: null,
  loading: true,
  setCurrentWorkspace: () => {},
  refreshWorkspaces: async () => {},
  isAdmin: false,
  isSupervisor: false,
})

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [rolesMap, setRolesMap] = useState<Record<string, WorkspaceRole>>({})
  const [currentWorkspace, setCurrentWs] = useState<Workspace | null>(null)
  const [currentRole, setCurrentRole] = useState<WorkspaceRole | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const loadWorkspaces = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }
    setCurrentUserId(user.id)

    // Usamos RPC SECURITY DEFINER para evitar bloqueos de RLS en
    // workspace_members y workspaces al leer desde el cliente (anon key)
    const { data, error } = await supabase.rpc('get_user_workspaces')

    if (error || !data) { setLoading(false); return }

    const rows = Array.isArray(data) ? data : []

    const wsList: Workspace[] = rows
      .map((row: any) => row.workspace)
      .filter(Boolean)

    const roles: Record<string, WorkspaceRole> = {}
    rows.forEach((row: any) => {
      if (row.workspace?.id) roles[row.workspace.id] = row.role
    })

    setWorkspaces(wsList)
    setRolesMap(roles)


    // Restaurar workspace activo desde localStorage
    const savedId = typeof window !== 'undefined'
      ? localStorage.getItem('active_workspace_id')
      : null

    let active = savedId ? wsList.find(w => w.id === savedId) : null
    if (!active && wsList.length > 0) active = wsList[0]

    if (active) {
      setCurrentWs(active)
      setCurrentRole(roles[active.id] ?? null)
    }

    setLoading(false)
  }, [])

  useEffect(() => {
    loadWorkspaces()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN') loadWorkspaces()
      if (event === 'SIGNED_OUT') {
        setWorkspaces([])
        setCurrentWs(null)
        setCurrentRole(null)
        setCurrentUserId(null)
      }
    })
    return () => subscription.unsubscribe()
  }, [loadWorkspaces])

  function setCurrentWorkspace(ws: Workspace) {
    setCurrentWs(ws)
    setCurrentRole(rolesMap[ws.id] ?? null)
    if (typeof window !== 'undefined') {
      localStorage.setItem('active_workspace_id', ws.id)
    }
  }

  const isAdmin = currentRole === 'admin'
  const isSupervisor = currentRole === 'admin' || currentRole === 'supervisor'

  return (
    <WorkspaceContext.Provider value={{
      workspaces,
      currentWorkspace,
      currentRole,
      currentUserId,
      loading,
      setCurrentWorkspace,
      refreshWorkspaces: loadWorkspaces,
      isAdmin,
      isSupervisor,
    }}>
      {children}
    </WorkspaceContext.Provider>
  )
}

export function useWorkspace() {
  return useContext(WorkspaceContext)
}
