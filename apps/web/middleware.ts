import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login", "/auth"];

/**
 * Edge-safe route gate. We only check for the presence of the Supabase auth
 * cookie here — no Supabase client in middleware (its dependency graph pulls
 * CommonJS code that breaks the Edge runtime, and a per-request network call
 * to Supabase would be slow anyway). Real session validation/refresh happens
 * in the browser client (all data access is client-side behind RLS) and in
 * the /auth/confirm route handler.
 */
export function middleware(request: NextRequest) {
  // Supabase stores the session as sb-<ref>-auth-token (possibly chunked
  // into .0/.1 suffixes).
  const hasSession = request.cookies
    .getAll()
    .some((c) => c.name.startsWith("sb-") && c.name.includes("-auth-token"));

  const isPublic = PUBLIC_PATHS.some((p) =>
    request.nextUrl.pathname.startsWith(p),
  );

  if (!hasSession && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (hasSession && request.nextUrl.pathname.startsWith("/login")) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Everything except static assets and PWA files.
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|icons/|splash/|sw.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
