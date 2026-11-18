import Link from "next/link";
import { AppHeader, BrandMark, StatusBadge, UserBadge } from "@/components/brand";
import { APP_NAME } from "@/lib/app";
import { signOutAction } from "@/lib/auth/actions";
import type { CurrentUser } from "@/lib/auth/current-user";
import { hasRole } from "@/lib/auth/roles";
import { NavLink } from "./NavLink";

export function SiteHeader({ user, wide = false }: { user: CurrentUser; wide?: boolean }) {
  return (
    <div className={wide ? "[&>header>div]:max-w-none" : undefined}>
      <AppHeader
        brand={
          <Link href="/">
            <BrandMark subtitle={APP_NAME} />
          </Link>
        }
        nav={
          user.role ? (
            <>
              <NavLink href="/">Reports</NavLink>
              {hasRole(user.role, "admin") && <NavLink href="/members">Members</NavLink>}
            </>
          ) : undefined
        }
        actions={
          <>
            {user.role && (
              <StatusBadge tone={user.role === "viewer" ? "neutral" : "green"}>
                {user.role}
              </StatusBadge>
            )}
            <UserBadge name={user.name}>
              <form action={signOutAction}>
                <button
                  type="submit"
                  className="text-xs uppercase tracking-[0.08em] text-ink-dark hover:text-brand-black underline decoration-brand-yellow underline-offset-4 cursor-pointer"
                >
                  Sign out
                </button>
              </form>
            </UserBadge>
          </>
        }
      />
    </div>
  );
}
