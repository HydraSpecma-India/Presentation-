"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { navLinkClasses } from "@/components/brand";

export function NavLink({ href, children }: { href: string; children: string }) {
  const pathname = usePathname();
  const active =
    href === "/" ? pathname === "/" || pathname.startsWith("/reports") : pathname.startsWith(href);
  return (
    <Link href={href} className={navLinkClasses(active)} aria-current={active ? "page" : undefined}>
      {children}
    </Link>
  );
}
