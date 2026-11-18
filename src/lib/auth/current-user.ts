import { cache } from "react";
import { supabaseServer } from "@/lib/supabase/server";
import { isRole, type Role } from "./roles";

export type CurrentUser = {
  id: string;
  email: string;
  name: string;
  role: Role | null;
  /** Signed in with a temporary password set by an admin. */
  mustChangePassword: boolean;
};

/**
 * The signed-in user and their app role, or null when signed out. getUser() validates the session
 * with Supabase Auth (never trust getSession() on the server). Cached per request.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const supabase = await supabaseServer();
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user?.email) return null;
  // RLS lets every user read their own member row (and only admins read the others).
  const { data: member } = await supabase
    .from("mr_members")
    .select("role, must_change_password")
    .eq("email", user.email.toLowerCase())
    .maybeSingle();
  const meta = user.user_metadata as { full_name?: unknown };
  const name =
    typeof meta.full_name === "string" && meta.full_name.trim() ? meta.full_name : user.email;
  return {
    id: user.id,
    email: user.email,
    name,
    role: isRole(member?.role) ? member.role : null,
    mustChangePassword: member?.must_change_password === true,
  };
});
