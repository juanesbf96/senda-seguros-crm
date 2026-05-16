import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const PUBLIC_ROUTES = ['/login', '/registro', '/invitacion', '/onboarding']

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const { pathname } = request.nextUrl

  const isPublic = PUBLIC_ROUTES.some(r => pathname.startsWith(r))

  // No autenticado → login (excepto rutas públicas)
  if (!user && !isPublic) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // Autenticado en login/registro → redirigir a app
  if (user && (pathname === '/login' || pathname === '/registro')) {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    return NextResponse.redirect(url)
  }

  // Autenticado en ruta protegida → verificar workspace configurado
  if (user && !isPublic) {
    const { data: members } = await supabase
      .from('workspace_members')
      .select('workspace_id, workspace:workspaces(setup_completed)')
      .eq('user_id', user.id)
      .limit(5)

    const hasSetupWorkspace = (members as any[] | null)?.some(
      (m: any) => m.workspace?.setup_completed === true
    )

    if (!hasSetupWorkspace) {
      const url = request.nextUrl.clone()
      url.pathname = '/onboarding'
      return NextResponse.redirect(url)
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
