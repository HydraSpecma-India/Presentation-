// Next.js 16 "proxy" (formerly middleware). It MUST stay at src/proxy.ts: with the app in
// src/app, Next only looks in src/. Refreshes the Supabase session cookie and sends anonymous
// visitors to /signin.
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseEnv } from "@/lib/supabase/env";

const PUBLIC_PATHS = ["/signin", "/auth/"];

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const { url, publishable } = supabaseEnv();
  const supabase = createServerClient(url, publishable, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (toSet) => {
        toSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        toSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const { data } = await supabase.auth.getUser();
  const path = request.nextUrl.pathname;
  const isPublic = PUBLIC_PATHS.some((p) => path === p || path.startsWith(p));

  if (!data.user && !isPublic) {
    if (path.startsWith("/api/")) {
      return NextResponse.json({ error: "Not signed in." }, { status: 401 });
    }
    const signin = request.nextUrl.clone();
    signin.pathname = "/signin";
    signin.search = path === "/" ? "" : `?next=${encodeURIComponent(path)}`;
    return NextResponse.redirect(signin);
  }
  return response;
}

// Deny by default: everything except static files goes through the check above.
export const config = {
  matcher: ["/((?!_next/static|_next/image|brand/|editor/|favicon.ico).*)"],
};
