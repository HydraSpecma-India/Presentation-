import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabaseEnv } from "./env";

/** Supabase client bound to the signed-in user's session cookies (server components, actions). */
export async function supabaseServer() {
  const cookieStore = await cookies();
  const { url, publishable } = supabaseEnv();
  return createServerClient(url, publishable, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (toSet) => {
        try {
          toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Called from a server component: cookies are read-only there, and the proxy refreshes them.
        }
      },
    },
  });
}
