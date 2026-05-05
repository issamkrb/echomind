"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Shared top navigation strip for the /admin/* pages.
 *
 * Centralised so /admin, /admin/logs, /admin/trash, /admin/gallery,
 * /admin/audit, and /admin/controls all show the same strip with
 * the same active-link styling. Each link carries the `?token=`
 * query through so the operator never has to re-type / re-paste
 * the admin token between subviews.
 */

type Tab = {
  href: string;
  label: string;
  /** Match the start of the pathname for active styling. */
  match: (path: string) => boolean;
};

const TABS: Tab[] = [
  {
    href: "/admin",
    label: "sessions",
    match: (p) =>
      p === "/admin" ||
      p.startsWith("/admin/auction"),
  },
  {
    href: "/admin/logs",
    label: "logs",
    match: (p) => p.startsWith("/admin/logs"),
  },
  {
    href: "/admin/gallery",
    label: "gallery",
    match: (p) => p.startsWith("/admin/gallery"),
  },
  {
    href: "/admin/trash",
    label: "trash",
    match: (p) => p.startsWith("/admin/trash"),
  },
  {
    href: "/admin/audit",
    label: "audit",
    match: (p) => p.startsWith("/admin/audit"),
  },
  {
    href: "/admin/controls",
    label: "controls",
    match: (p) => p.startsWith("/admin/controls"),
  },
  {
    href: "/admin/market",
    label: "market",
    match: (p) => p.startsWith("/admin/market"),
  },
];

export function AdminTopNav({ token }: { token: string }) {
  const pathname = usePathname() ?? "";
  const q = token ? `?token=${encodeURIComponent(token)}` : "";

  return (
    <nav
      aria-label="admin sections"
      className="border border-terminal-border bg-black/60 px-3 py-2 mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] uppercase tracking-widest text-terminal-dim"
    >
      {TABS.map((t) => {
        const active = t.match(pathname);
        return (
          <Link
            key={t.href}
            href={`${t.href}${q}`}
            className={
              active
                ? "text-terminal-green terminal-glow"
                : "hover:text-terminal-green"
            }
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
