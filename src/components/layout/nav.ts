import { ClipboardList, Package, UserCog, type LucideIcon } from "lucide-react";
import type { UserRole } from "@/lib/backend/types";

/** Кто видит пункт меню. Пустой список — видят все вошедшие. */
export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  roles?: UserRole[];
}

export const NAV: NavItem[] = [
  { href: "/orders", label: "Заказы", icon: Package },
  {
    href: "/cancellations",
    label: "Журнал",
    icon: ClipboardList,
    roles: ["ADMIN", "SUPERVISOR"],
  },
  { href: "/users", label: "Сотрудники", icon: UserCog, roles: ["ADMIN"] },
];

/** Пункты, доступные роли: меню и проверка прямых ссылок берут их отсюда. */
export function navFor(role: UserRole | null | undefined): NavItem[] {
  if (!role) return [];
  return NAV.filter((item) => !item.roles || item.roles.includes(role));
}

/** Экран, с которого роль начинает рабочий день. */
const HOME: Partial<Record<UserRole, string>> = {
  SUPERVISOR: "/cancellations",
};

/** Куда вести после входа: рабочий экран роли, иначе первый доступный. */
export function homeFor(role: UserRole | null | undefined): string {
  if (!role) return "/login";
  return HOME[role] ?? navFor(role)[0]?.href ?? "/login";
}

/** Открыт ли экран этой роли — по тому же списку, что и меню. */
export function canOpen(pathname: string, role: UserRole | null | undefined): boolean {
  const item = [...NAV]
    .sort((a, b) => b.href.length - a.href.length)
    .find((entry) => isNavActive(pathname, entry.href));
  if (!item) return true;
  return navFor(role).includes(item);
}

export function isNavActive(pathname: string, href: string): boolean {
  const matches = (item: string) => pathname === item || pathname.startsWith(`${item}/`);
  if (!matches(href)) return false;
  return !NAV.some(
    (item) => item.href !== href && item.href.length > href.length && matches(item.href),
  );
}
