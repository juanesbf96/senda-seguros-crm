'use client'
import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react'
import { supabase } from '@/lib/supabase/client'
import { useWorkspace } from './WorkspaceContext'

// ── Todas las claves de permiso válidas ──────────────────────
export type PermissionKey =
  // Clientes
  | 'clientes_ver_todos'
  | 'clientes_crear'
  | 'clientes_editar_propios'
  | 'clientes_editar_todos'
  | 'clientes_eliminar'
  // Pólizas
  | 'polizas_ver'
  | 'polizas_crear'
  | 'polizas_editar'
  | 'polizas_eliminar'
  // Tareas
  | 'tareas_ver_todas'
  | 'tareas_crear'
  | 'tareas_completar_propias'
  | 'tareas_editar_todas'
  | 'tareas_asignar'
  // Finanzas
  | 'finanzas_cobros_ver'
  | 'finanzas_cobros_registrar'
  | 'finanzas_liquidaciones_ver'
  | 'finanzas_liquidaciones_crear'
  | 'finanzas_caja_ver_propias'
  | 'finanzas_caja_ver_todas'
  // Siniestros
  | 'siniestros_ver'
  | 'siniestros_crear'
  | 'siniestros_editar_todos'
  // Solicitudes
  | 'solicitudes_ver'
  | 'solicitudes_crear'
  | 'solicitudes_aprobar_propias'
  | 'solicitudes_aprobar_todas'
  // Metas
  | 'metas_ver'
  | 'metas_crear_editar'
  | 'metas_ver_metricas'
  // Dashboard
  | 'dashboard_ver_global'
  | 'dashboard_ver_propias'
  // Configuración
  | 'configuracion_ver'
  | 'configuracion_editar_agencia'
  | 'configuracion_workspace_miembros'
  // Pipeline
  | 'pipeline_ver'
  | 'pipeline_mover_propios'
  | 'pipeline_mover_todos'
  | 'pipeline_eliminar_propios'
  | 'pipeline_eliminar_todos'

interface PermissionsContextType {
  can: (key: PermissionKey) => boolean
  loading: boolean
  refreshPermissions: () => Promise<void>
  isAdmin: boolean  // admin tiene todo sin consultar permisos
}

const PermissionsContext = createContext<PermissionsContextType>({
  can: () => false,
  loading: true,
  refreshPermissions: async () => {},
  isAdmin: false,
})

export function PermissionsProvider({ children }: { children: ReactNode }) {
  const { currentWorkspace, currentRole, loading: wsLoading, isAdmin } = useWorkspace()
  const [permissions, setPermissions] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(true)

  const loadPermissions = useCallback(async () => {
    if (wsLoading) return
    if (!currentWorkspace) { setLoading(false); return }

    // Admin tiene todos los permisos sin necesidad de consultar
    if (isAdmin || currentRole === null) {
      setPermissions({})  // vacío → can() retorna true para admin
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      const { data, error } = await supabase.rpc('get_my_permissions', {
        p_workspace_id: currentWorkspace.id,
      })

      if (error) throw error

      const map: Record<string, boolean> = {}
      if (Array.isArray(data)) {
        data.forEach((row: any) => {
          map[row.permission_key] = row.enabled
        })
      }
      setPermissions(map)
    } catch (e) {
      console.error('Error cargando permisos:', e)
      setPermissions({})
    } finally {
      setLoading(false)
    }
  }, [currentWorkspace?.id, currentRole, isAdmin, wsLoading])

  useEffect(() => {
    loadPermissions()
  }, [loadPermissions])

  function can(key: PermissionKey): boolean {
    // Admin siempre puede todo
    if (isAdmin || currentRole === null) return true
    // Supervisor: tiene todo excepto lo que se haya desactivado
    if (currentRole === 'supervisor') {
      return permissions[key] !== false  // true si no hay override en false
    }
    // Agente: solo lo que esté explícitamente en true
    return permissions[key] === true
  }

  return (
    <PermissionsContext.Provider value={{
      can,
      loading,
      refreshPermissions: loadPermissions,
      isAdmin,
    }}>
      {children}
    </PermissionsContext.Provider>
  )
}

export function usePermissions() {
  return useContext(PermissionsContext)
}
