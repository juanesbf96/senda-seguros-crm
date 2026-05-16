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
  loading: true,
  setCurrentWorkspace: () => {},
  refreshWorkspaces: async () => {},
  isAdmin: false,
  isSupervisor: false,
})

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [currentWorkspace, setCurrentWs] = useState<Workspace | null>(null)
  const [currentRole, setCurrentRole] = useState<WorkspaceRole | null>(null)
  const [loading, setLoading] = useState(true)

  const loadWorkspaces = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    const { data, error } = await supabase
      .from('workspace_members')
      .select(`
        role,
        workspace:workspaces (
          id, name, owner_id, slug, setup_completed, created_at
        )
      `)
      .eq('user_id', user.id)

    if (error || !data) { setLoading(false); return }

    const wsList: Workspace[] = data
      .map((row: any) => row.workspace)
      .filter(Boolean)

    const roles: Record<string, WorkspaceRole> = {}
    data.forEach((row: any) => {
      if (row.workspace?.id) roles[row.workspace.id] = row.role
    })

    setWorkspaces(wsList)

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
      }
    })
    return () => subscription.unsubscribe()
  }, [loadWorkspaces])

  function setCurrentWorkspace(ws: Workspace) {
    setCurrentWs(ws)
    // Obtener rol para el nuevo workspace
    const idx = workspaces.findIndex(w => w.id === ws.id)
    if (idx >= 0) {
      // El rol se guarda en el contexto; aquí lo buscamos del state actual
      supabase
        .from('workspace_members')
        .select('role')
        .eq('workspace_id', ws.id)
        .eq('user_id', supabase.auth.getUser().then(r => r.data.user?.id))
        .single()
        .then(({ data }) => {
          if (data) setCurrentRole(data.role as WorkspaceRole)
        })
    }
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
