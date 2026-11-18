"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth/guards";
import { isAllowedEmail, ROLES } from "@/lib/auth/roles";
import { supabaseServer } from "@/lib/supabase/server";

const memberSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .refine(isAllowedEmail, "Only @hydraspecma.com addresses can be added."),
  role: z.enum(ROLES),
});

export type MemberFormState = { error?: string; ok?: string };

export async function saveMember(_prev: MemberFormState, form: FormData): Promise<MemberFormState> {
  try {
    const admin = await requireRole("admin");
    const parsed = memberSchema.safeParse({ email: form.get("email"), role: form.get("role") });
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form." };
    const { email, role } = parsed.data;
    if (email === admin.email.toLowerCase() && role !== "admin") {
      return { error: "You can't remove your own admin role." };
    }
    const supabase = await supabaseServer();
    const { error } = await supabase
      .from("mr_members")
      .upsert({ email, role, added_by: admin.email.toLowerCase() }, { onConflict: "email" });
    if (error) return { error: error.message };
    revalidatePath("/members");
    return { ok: `${email} is now ${role}.` };
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

export async function removeMember(form: FormData) {
  const admin = await requireRole("admin");
  const email = z.string().trim().toLowerCase().parse(form.get("email"));
  if (email === admin.email.toLowerCase()) return;
  const supabase = await supabaseServer();
  await supabase.from("mr_members").delete().eq("email", email);
  revalidatePath("/members");
}
