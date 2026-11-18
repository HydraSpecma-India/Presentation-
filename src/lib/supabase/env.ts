// Public Supabase settings. The publishable key is designed to be shipped to browsers; access is
// decided by row-level security in the database, not by keeping this value secret.
export function supabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishable = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE;
  if (!url || !publishable) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE must be set.");
  }
  return { url, publishable };
}
