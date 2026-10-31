import { NextResponse, type NextRequest } from "next/server";

/**
 * Прокси `/api` на бэкенд.
 *
 * API живёт на том же origin, что страница, — кука сессии своя для браузера,
 * и Safari её не выбрасывает (стороннюю куку на чужой домен он не сохраняет).
 *
 * Бэкенд видит запросы с адресов Vercel, общих для всех клиентов. Чтобы лимит
 * неудачных входов считался по настоящему адресу, прокси передаёт его в
 * отдельном заголовке вместе с секретом `API_PROXY_SECRET`; без секрета
 * бэкенд этому заголовку не верит.
 */
const API_ORIGIN = (process.env.API_ORIGIN ?? "http://localhost:4000").replace(/\/+$/, "");
const PROXY_SECRET = process.env.API_PROXY_SECRET;

export function proxy(request: NextRequest) {
  const headers = new Headers(request.headers);
  // Свои заголовки ставим только сами: присланные клиентом — выбрасываем.
  headers.delete("x-bpk-client-ip");
  headers.delete("x-bpk-proxy-secret");
  if (PROXY_SECRET) {
    // На Vercel x-forwarded-for выставляет сама платформа — первым идёт клиент.
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip")?.trim();
    if (ip) headers.set("x-bpk-client-ip", ip);
    headers.set("x-bpk-proxy-secret", PROXY_SECRET);
  }

  const target = new URL(`${request.nextUrl.pathname}${request.nextUrl.search}`, API_ORIGIN);
  return NextResponse.rewrite(target, { request: { headers } });
}

export const config = {
  matcher: "/api/:path*",
};
