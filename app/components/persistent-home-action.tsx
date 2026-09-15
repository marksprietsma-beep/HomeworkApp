"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const routesWithoutHomeAction = new Set(["/", "/login", "/setup", "/change-password"]);

export function PersistentHomeAction({ authenticated }: { authenticated: boolean }) {
  const pathname = usePathname();

  if (!authenticated || routesWithoutHomeAction.has(pathname)) {
    return null;
  }

  return (
    <nav aria-label="Home navigation" className="fixed left-4 top-4 z-50">
      <Link
        href="/"
        className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/90 px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm backdrop-blur transition hover:border-slate-300 hover:text-slate-950 focus:outline-none focus:ring-2 focus:ring-amber-400"
      >
        <span aria-hidden="true">⌂</span>
        <span>Home</span>
      </Link>
    </nav>
  );
}
