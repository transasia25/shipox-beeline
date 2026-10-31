import type { NextConfig } from "next";

/*
 * Запросы `/api/*` проксирует на бэкенд `src/proxy.ts` (адрес — API_ORIGIN).
 * На Vercel в настройках проекта задаются:
 *   API_ORIGIN        — адрес бэкенда, например https://165-245-198-243.sslip.io
 *   API_PROXY_SECRET  — тот же секрет, что в backend/.env
 */

const nextConfig: NextConfig = {
  // Сборка с минимальным server.js — так образ Docker не тащит все node_modules.
  output: "standalone",
  // Значок Next.js в углу экрана операторам не нужен. Ошибки сборки и
  // выполнения при разработке Next.js всё равно покажет.
  devIndicators: false,
  // Защитные заголовки. Фронт живёт на Vercel без нашего Caddy, поэтому они
  // здесь: запрет встраивания во фреймы (чтобы обманом не нажали «Отменить»),
  // CSP «только свой домен», HSTS. Строгая CSP — только в боевой сборке:
  // при разработке Next.js нужны eval и веб-сокет для горячей перезагрузки.
  async headers() {
    const production = process.env.NODE_ENV === "production";
    const csp = production
      ? "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; " +
        "img-src 'self' data:; font-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; " +
        "base-uri 'self'; form-action 'self'; object-src 'none'"
      : "frame-ancestors 'none'";
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
          ...(production
            ? [{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }]
            : []),
        ],
      },
    ];
  },
};

export default nextConfig;
