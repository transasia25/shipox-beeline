"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { isNavActive, navFor } from "./nav";
import type { UserRole } from "@/lib/backend/types";

/**
 * Боковая колонка, как в дашборде Shipox: узкая, только иконки. Развёрнутая
 * (по «гамбургеру» в шапке) — с подписями.
 */
export function AppSidebar({ role, expanded }: { role: UserRole; expanded: boolean }) {
  const pathname = usePathname();

  return (
    <aside
      className={cn(
        "sticky top-14 hidden h-[calc(100vh-3.5rem)] shrink-0 border-r border-border bg-sidebar transition-[width] lg:block",
        expanded ? "w-56" : "w-16",
      )}
    >
      <NavLinks pathname={pathname} role={role} expanded={expanded} className="px-2 py-4" />
    </aside>
  );
}

export function NavLinks({
  pathname,
  role,
  expanded = true,
  className,
  onNavigate,
}: {
  pathname: string;
  role: UserRole;
  expanded?: boolean;
  className?: string;
  onNavigate?: () => void;
}) {
  return (
    <nav className={cn("space-y-1", className)}>
      {navFor(role).map((item) => {
        const active = isNavActive(pathname, item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            title={expanded ? undefined : item.label}
            className={cn(
              "flex h-11 items-center gap-3 rounded-md px-3 text-sm transition-colors",
              active
                ? "bg-sidebar-accent font-medium text-primary"
                : "text-slate-400 hover:bg-sidebar-accent/60 hover:text-primary",
            )}
          >
            <Icon className="size-5 shrink-0" />
            {expanded && <span className="truncate">{item.label}</span>}
          </Link>
        );
      })}
    </nav>
  );
}
