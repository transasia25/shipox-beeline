"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { CircleUserRound, KeyRound, LogOut, Menu } from "lucide-react";
import { toast } from "sonner";
import { AppSidebar, NavLinks } from "./app-sidebar";
import { canOpen, homeFor } from "./nav";
import { changeOwnPassword } from "@/lib/backend/client";
import { ROLE_LABEL, signOut, useSession } from "@/lib/session";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const session = useSession();
  const [expanded, setExpanded] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  // Гостя отправляем на форму входа: сам экран входа оболочку не надевает.
  useEffect(() => {
    if (session.status === "guest" && pathname !== "/login") router.replace("/login");
  }, [session.status, pathname, router]);

  // С закрытого для роли экрана уводим на её первый доступный: так по старой
  // ссылке из чата человек попадает в работу, а не в тупик.
  useEffect(() => {
    if (session.status !== "signed-in") return;
    if (!canOpen(pathname, session.user.role)) router.replace(homeFor(session.user.role));
  }, [session, pathname, router]);

  if (pathname === "/login") return <>{children}</>;
  if (session.status !== "signed-in") {
    return (
      <div className="min-h-screen px-6 py-6">
        <ShellSkeleton />
      </div>
    );
  }

  const user = session.user;

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-card px-3 lg:px-4">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Меню"
            onClick={() => {
              // На широком экране «гамбургер» разворачивает колонку, на узком — открывает шторку.
              if (window.matchMedia("(min-width: 1024px)").matches) setExpanded((value) => !value);
              else setMobileOpen(true);
            }}
          >
            <Menu className="size-5" />
          </Button>
          <div className="flex items-center gap-3">
            {/* Логотип перевозчика: кабинет — сервис Transasia Express для клиента. */}
            {/* eslint-disable-next-line @next/next/no-img-element -- SVG, оптимизация не нужна */}
            <img
              src="/transasia-express.svg"
              alt="Transasia Express"
              width={226}
              height={33}
              className="h-6 w-auto"
            />
            <div className="hidden border-l border-border pl-3 leading-tight sm:block">
              <div className="text-sm font-bold tracking-wide text-primary">BEELINE</div>
              <div className="text-[11px] text-muted-foreground">кабинет колл-центра</div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button variant="ghost" className="h-10 gap-2 px-2">
                  <span className="hidden text-right leading-tight sm:block">
                    <span className="block text-sm">{user.name}</span>
                    <span className="block text-[11px] text-muted-foreground">{ROLE_LABEL[user.role]}</span>
                  </span>
                  <CircleUserRound className="size-7 text-slate-500" />
                </Button>
              }
            />
            <DropdownMenuContent align="end" className="w-52">
              {/* Подпись группы обязана стоять внутри группы: без неё Base UI
                  падает при открытии меню, и меню не открывается вовсе. */}
              <DropdownMenuGroup>
                <DropdownMenuLabel>{user.login}</DropdownMenuLabel>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setChangingPassword(true)}>
                <KeyRound className="size-4" />
                Сменить пароль
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => void signOut()}>
                <LogOut className="size-4" />
                Выйти
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {/* Выход — на виду, а не только в меню: колл-центр работает за общими
              компьютерами, и оператор должен выйти одним нажатием. */}
          <Button variant="ghost" size="sm" onClick={() => void signOut()} title="Выйти">
            <LogOut className="size-4" />
            <span className="hidden sm:inline">Выйти</span>
          </Button>
        </div>
      </header>

      <div className="flex">
        <AppSidebar role={user.role} expanded={expanded} />
        <main className="min-w-0 flex-1 p-4 lg:p-6">
          {canOpen(pathname, user.role) ? children : <ShellSkeleton />}
        </main>
      </div>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="gap-2 pt-12">
          <SheetTitle className="px-4 text-sm font-bold text-primary">BEELINE · колл-центр</SheetTitle>
          <NavLinks
            pathname={pathname}
            role={user.role}
            className="px-2"
            onNavigate={() => setMobileOpen(false)}
          />
        </SheetContent>
      </Sheet>

      <ChangePasswordDialog open={changingPassword} onClose={() => setChangingPassword(false)} />
    </div>
  );
}

/** Смена своего пароля: остальные устройства сотрудника выходят из кабинета. */
function ChangePasswordDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      await changeOwnPassword({ currentPassword: current, password: next });
      toast.success("Пароль сменён. На других устройствах войдите заново.");
      setCurrent("");
      setNext("");
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось сменить пароль");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(value) => !value && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogTitle>Сменить пароль</DialogTitle>
        <DialogDescription>Новый пароль — не короче восьми символов.</DialogDescription>
        <form onSubmit={submit} className="space-y-3 pt-2">
          <div className="space-y-1.5">
            <Label htmlFor="current-password">Текущий пароль</Label>
            <Input
              id="current-password"
              type="password"
              value={current}
              onChange={(event) => setCurrent(event.target.value)}
              autoComplete="current-password"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="new-password">Новый пароль</Label>
            <Input
              id="new-password"
              type="password"
              value={next}
              onChange={(event) => setNext(event.target.value)}
              autoComplete="new-password"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Отмена
            </Button>
            <Button type="submit" disabled={busy || !current || next.length < 8}>
              {busy ? "Меняю…" : "Сменить"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ShellSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-96" />
    </div>
  );
}
