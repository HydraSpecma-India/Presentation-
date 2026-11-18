import { redirect } from "next/navigation";
import { getCurrentUser, type CurrentUser } from "./current-user";
import { hasRole, type Role } from "./roles";

/** For server actions: returns the user if they hold `minimum`, otherwise throws. */
export async function requireRole(minimum: Role): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not signed in.");
  if (!hasRole(user.role, minimum)) throw new Error("You do not have permission to do this.");
  return user;
}

/** For pages: sends anonymous users to sign-in. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/signin");
  return user;
}
