import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const PUBLIC_ROUTES = ['/login', '/registro', '/invitacion']

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Rutas públicas: siempre permitir
  if (PUBLIC_ROUTES.some(r => pathname.startsWith(r))) {
    return NextResponse.next()
  }

  const response = NextResponse.next()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value)
            response.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  // No autenticado → login
  if (!user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Ruta de onboarding: permitir si está autenticado
  if (pathname.startsWith('/onboarding')) {
    return response
  }

  // Verificar que el usuario tiene al menos un workspace configurado
  const { data: members } = await supabase
    .from('workspace_members')
    .select('workspace_id, workspace:workspaces(setup_completed)')
    .eq('user_id', user.id)
    .limit(1)

  const hasSetupWorkspace = members?.some(
    (m: any) => m.workspace?.setup_completed === true
  )

  if (!hasSetupWorkspace) {
    return NextResponse.redirect(new URL('/onboarding', request.url))
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
