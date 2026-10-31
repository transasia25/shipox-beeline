import type { Metadata } from "next";
import { Roboto, Roboto_Mono } from "next/font/google";
import "./globals.css";
import { AppShell } from "@/components/layout/app-shell";
import { Toaster } from "@/components/ui/sonner";

// Roboto — как в дашборде Shipox: операторы видят привычную плотность таблиц.
const roboto = Roboto({
  variable: "--font-sans",
  // Вариативный шрифт: все начертания одним файлом, список весов не нужен.
  subsets: ["latin", "cyrillic"],
});

const robotoMono = Roboto_Mono({
  variable: "--font-roboto-mono",
  subsets: ["latin", "cyrillic"],
});

export const metadata: Metadata = {
  title: "Beeline — кабинет колл-центра",
  description: "Поиск и отмена заказов Beeline в Shipox, журнал отмен для руководства",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ru"
      className={`${roboto.variable} ${robotoMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-background">
        <AppShell>{children}</AppShell>
        <Toaster position="top-right" />
      </body>
    </html>
  );
}
