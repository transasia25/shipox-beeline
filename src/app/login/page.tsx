"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { LogIn, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { getAuthState, login as loginRequest, setupAdmin } from "@/lib/backend/client";
import { homeFor } from "@/components/layout/nav";
import { loadSession, signedIn, useSession } from "@/lib/session";

/**
 * Вход в систему.
 *
 * Пока в базе нет ни одного сотрудника, та же страница предлагает завести
 * администратора: иначе после установки в систему нельзя было бы попасть
 * иначе как через базу.
 */
export default function LoginPage() {
  const router = useRouter();
  const session = useSession();
  const [needsSetup, setNeedsSetup] = useState<boolean | null>(null);
  const [setupKeyRequired, setSetupKeyRequired] = useState(false);
  const [setupKey, setSetupKey] = useState("");

  const [login, setLogin] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getAuthState()
      .then((state) => {
        setNeedsSetup(state.needsSetup);
        setSetupKeyRequired(state.setupKeyRequired);
      })
      .catch(() => setNeedsSetup(false));
  }, []);

  useEffect(() => {
    // Каждого ведём на его первый экран: оператора — к заказам, руководителя — в журнал.
    if (session.status === "signed-in") router.replace(homeFor(session.user.role));
  }, [session, router]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const user = needsSetup
        ? await setupAdmin({ login, name, password, setupKey: setupKey || undefined })
        : await loginRequest({ login, password });
      signedIn(user);
      await loadSession(true);
      router.replace(homeFor(user.role));
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Войти не удалось");
      setBusy(false);
    }
  };

  if (needsSetup === null || session.status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Skeleton className="h-72 w-full max-w-sm" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="items-center gap-2 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element -- SVG, оптимизация не нужна */}
          <img
            src="/transasia-express.svg"
            alt="Transasia Express"
            width={226}
            height={33}
            className="mx-auto mb-2 h-8 w-auto"
          />
          <CardTitle className="text-lg">Beeline · кабинет колл-центра</CardTitle>
          <p className="text-sm text-muted-foreground">
            {needsSetup
              ? "Первый запуск: заведите администратора — он потом добавит остальных."
              : "Войдите, чтобы продолжить."}
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="login">Логин</Label>
              <Input
                id="login"
                value={login}
                onChange={(event) => setLogin(event.target.value)}
                autoFocus
                autoComplete="username"
                placeholder="operator1"
              />
            </div>

            {needsSetup && (
              <div className="space-y-1.5">
                <Label htmlFor="name">Имя</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Азизова Д."
                />
                <p className="text-xs text-muted-foreground">
                  Этим именем будут подписаны отмены в журнале.
                </p>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="password">Пароль</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete={needsSetup ? "new-password" : "current-password"}
              />
              {needsSetup && (
                <p className="text-xs text-muted-foreground">Не короче восьми символов.</p>
              )}
            </div>

            {needsSetup && setupKeyRequired && (
              <div className="space-y-1.5">
                <Label htmlFor="setup-key">Ключ настройки</Label>
                <Input
                  id="setup-key"
                  type="password"
                  value={setupKey}
                  onChange={(event) => setSetupKey(event.target.value)}
                  autoComplete="off"
                />
                <p className="text-xs text-muted-foreground">
                  Значение AUTH_SETUP_KEY из настроек сервера — его знает тот, кто разворачивал кабинет.
                </p>
              </div>
            )}

            {error && <p className="text-sm text-destructive">{error}</p>}

            <Button
              type="submit"
              className="w-full"
              disabled={
                busy ||
                !login.trim() ||
                !password ||
                (needsSetup && !name.trim()) ||
                (needsSetup && setupKeyRequired && !setupKey.trim())
              }
            >
              {needsSetup ? <UserPlus className="size-4" /> : <LogIn className="size-4" />}
              {busy ? "Проверяю…" : needsSetup ? "Завести администратора" : "Войти"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
