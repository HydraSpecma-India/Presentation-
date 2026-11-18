"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth/guards";
import { passwordProblem } from "@/lib/auth/password";
import { isAllowedEmail, ROLES } from "@/lib/auth/roles";
import { supabaseServer } from "@/lib/supabase/server";

// Every action re-checks the admin role here, and the database functions check it again.

const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .refine(isAllowedEmail, "Only @hydraspecma.com addresses can be added.");
const passwordSchema = z.string().superRefine((pw, ctx) => {
  const problem = passwordProblem(pw);
  if (problem) ctx.addIssue({ code: "custom", message: problem });
});

const createSchema = z.object({
  email: emailSchema,
  fullName: z.string().trim().max(120),
  role: z.enum(ROLES),
  password: passwordSchema,
});

export type MemberResult =
  { ok: true; message: string; password?: string } | { ok: false; error: string };

const fail = (e: unknown): MemberResult => ({
  ok: false,
  error: e instanceof Error ? e.message : String(e),
});

/** Creates the login (or, for an existing HydraSpecma login, only grants access). */
export async function createUser(input: {
  email: string;
  fullName: string;
  role: string;
  password: string;
}): Promise<MemberResult> {
  try {
    await requireRole("admin");
    const parsed = createSchema.safeParse(input);
    if (!parsed.success)
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form." };
    const { email, fullName, role, password } = parsed.data;
    const supabase = await supabaseServer();
    const { data, error } = await supabase.rpc("mr_admin_create_user", {
      p_email: email,
      p_full_name: fullName,
      p_role: role,
      p_temp_password: password,
    });
    if (error) return { ok: false, error: error.message };
    revalidatePath("/members");
    return data === "existing"
      ? {
          ok: true,
          message: `${email} already has a HydraSpecma login in this system, so they keep their current password. They now have ${role} access.`,
        }
      : {
          ok: true,
          message: `Account created for ${email} (${role}). Share this temporary password with them; they must change it at first sign-in.`,
          password,
        };
  } catch (e) {
    return fail(e);
  }
}

export async function setMemberRole(email: string, role: string): Promise<MemberResult> {
  try {
    const admin = await requireRole("admin");
    const e = emailSchema.parse(email);
    const r = z.enum(ROLES).parse(role);
    if (e === admin.email.toLowerCase() && r !== "admin") {
      return { ok: false, error: "You can't remove your own admin role." };
    }
    const supabase = await supabaseServer();
    const { error } = await supabase.from("mr_members").update({ role: r }).eq("email", e);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/members");
    return { ok: true, message: `${e} is now ${r}.` };
  } catch (err) {
    return fail(err);
  }
}

export async function resetMemberPassword(email: string, password: string): Promise<MemberResult> {
  try {
    await requireRole("admin");
    const e = emailSchema.parse(email);
    const pw = passwordSchema.parse(password);
    const supabase = await supabaseServer();
    const { error } = await supabase.rpc("mr_admin_reset_password", {
      p_email: e,
      p_temp_password: pw,
    });
    if (error) return { ok: false, error: error.message };
    revalidatePath("/members");
    return { ok: true, message: `New temporary password for ${e}:`, password: pw };
  } catch (err) {
    return fail(err);
  }
}

/** Removes access to this app. The login itself stays (it may be used by other apps). */
export async function removeMember(email: string): Promise<MemberResult> {
  try {
    const admin = await requireRole("admin");
    const e = emailSchema.parse(email);
    if (e === admin.email.toLowerCase()) return { ok: false, error: "You can't remove yourself." };
    const supabase = await supabaseServer();
    const { error } = await supabase.from("mr_members").delete().eq("email", e);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/members");
    return { ok: true, message: `${e} no longer has access.` };
  } catch (err) {
    return fail(err);
  }
}
