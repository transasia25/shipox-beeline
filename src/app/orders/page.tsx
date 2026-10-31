"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Ban, ChevronLeft, ChevronRight, Plus, RefreshCw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CancelOrderDialog } from "@/components/orders/cancel-dialog";
import { DateCell, RecipientCell, ServiceCell, StatusCell } from "@/components/orders/order-cells";
import { ErrorState } from "@/components/ui-kit/error-state";
import { useBackend } from "@/hooks/use-backend";
import { getOrderCounts, listOrders } from "@/lib/backend/client";
import type { Order, OrderCounts, OrderTab } from "@/lib/backend/types";
import { formatNumber, formatUzs } from "@/lib/format";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 20;

/** Вкладки — как полоса фильтров над списком в Shipox. */
const TABS: { key: "all" | OrderTab; label: string }[] = [
  { key: "all", label: "Все" },
  { key: "active", label: "В работе" },
  { key: "delivered", label: "Доставлено" },
  { key: "returns", label: "Возвраты" },
  { key: "cancelled", label: "Отменённые" },
];

/**
 * Заказы Beeline прямо из Shipox.
 *
 * Поиск запускается по Enter, а не на каждый символ: каждый запрос уходит в
 * Shipox, и набор номера из пятнадцати цифр дал бы пятнадцать запросов.
 */
export default function OrdersPage() {
  const router = useRouter();
  const [draft, setDraft] = useState("");
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"all" | OrderTab>("all");
  const [page, setPage] = useState(0);
  const [cancelling, setCancelling] = useState<Order | null>(null);

  const orders = useBackend(
    () => listOrders({ search, tab: tab === "all" ? undefined : tab, page, size: PAGE_SIZE }),
    [search, tab, page],
  );
  const counts = useBackend(() => getOrderCounts({ search }), [search]);

  const reload = () => {
    orders.reload();
    counts.reload();
  };

  const items = orders.data?.items ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-medium">Заказы</h1>
        <Button nativeButton={false} render={<Link href="/orders/new" />} className="h-9 px-4 uppercase">
          <Plus className="size-4" />
          Создать заказ
        </Button>
      </div>

      <div className="overflow-hidden rounded-md bg-card shadow-sm">
        <Tabs
          value={tab}
          counts={counts.data}
          onChange={(next) => {
            setTab(next);
            setPage(0);
          }}
        />

        <form
          onSubmit={(event) => {
            event.preventDefault();
            setSearch(draft.trim());
            setPage(0);
          }}
          className="flex items-center gap-2 border-y border-border px-4"
        >
          <Search className="size-4 text-muted-foreground" />
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Поиск: номер заказа, номер Beeline или телефон — и Enter"
            className="h-12 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            autoFocus
            inputMode="search"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Обновить"
            title="Обновить"
            onClick={reload}
            disabled={orders.loading}
          >
            <RefreshCw className={cn("size-5 text-slate-500", orders.loading && "animate-spin")} />
          </Button>
        </form>

        {orders.error ? (
          <div className="p-4">
            <ErrorState message={orders.error} onRetry={reload} />
          </div>
        ) : !orders.data ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-16" />
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="text-muted-foreground">
                  <th className="px-4 py-3 text-center font-normal">Номер заказа</th>
                  <th className="px-3 py-3 text-left font-normal">Адрес доставки</th>
                  <th className="px-3 py-3 text-left font-normal">Сервис</th>
                  <th className="px-3 py-3 text-center font-normal">Время создания</th>
                  <th className="px-3 py-3 text-center font-normal">Статус</th>
                  <th className="px-3 py-3 text-right font-normal">Наложенный платёж</th>
                  <th className="w-0 px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="h-40 text-center text-muted-foreground">
                      {search ? `По запросу «${search}» заказов нет` : "Заказов нет"}
                    </td>
                  </tr>
                ) : (
                  items.map((order) => (
                    <tr
                      key={order.id}
                      onClick={() => router.push(`/orders/${encodeURIComponent(order.id)}`)}
                      className="cursor-pointer even:bg-row-stripe hover:bg-accent"
                    >
                      <td className="px-4 py-3 text-center leading-snug">
                        <div className="font-medium text-order-number tabular-nums">{order.orderNumber}</div>
                        <div>{order.referenceId ?? "Не доступен"}</div>
                      </td>
                      <td className="px-3 py-3">
                        <RecipientCell party={order.recipient} />
                      </td>
                      <td className="px-3 py-3">
                        <ServiceCell service={order.service} />
                      </td>
                      <td className="px-3 py-3">
                        <DateCell iso={order.createdAt} />
                      </td>
                      <td className="px-3 py-3">
                        <StatusCell status={order.status} date={order.statusChangedAt} />
                      </td>
                      <td className="px-3 py-3 text-right font-medium whitespace-nowrap tabular-nums">
                        {order.codAmount ? formatUzs(order.codAmount) : formatUzs(0)}
                      </td>
                      <td className="px-4 py-3">
                        {order.cancellable && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="border-destructive/40 text-destructive hover:bg-destructive/5 hover:text-destructive"
                            onClick={(event) => {
                              event.stopPropagation();
                              setCancelling(order);
                            }}
                          >
                            <Ban className="size-4" />
                            Отменить
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {orders.data && (page > 0 || orders.data.hasMore) && (
          <div className="flex items-center justify-end gap-2 border-t border-border px-4 py-2 text-sm text-muted-foreground">
            <span className="tabular-nums">
              {page * PAGE_SIZE + 1}–{page * PAGE_SIZE + items.length}
              {orders.data.total !== null && ` из ${formatNumber(orders.data.total)}`}
            </span>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Назад"
              onClick={() => setPage((value) => Math.max(0, value - 1))}
              disabled={page === 0 || orders.loading}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Вперёд"
              onClick={() => setPage((value) => value + 1)}
              disabled={!orders.data.hasMore || orders.loading}
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        )}
      </div>

      <CancelOrderDialog
        order={cancelling}
        onClose={() => setCancelling(null)}
        onCancelled={reload}
      />
    </div>
  );
}

function Tabs({
  value,
  counts,
  onChange,
}: {
  value: "all" | OrderTab;
  counts: OrderCounts | null;
  onChange: (tab: "all" | OrderTab) => void;
}) {
  return (
    <div className="flex overflow-x-auto px-2">
      {TABS.map((tab) => {
        const active = tab.key === value;
        const count = counts?.[tab.key];
        return (
          <button
            key={tab.key}
            type="button"
            onClick={() => onChange(tab.key)}
            className={cn(
              "flex flex-1 items-center justify-center gap-2 border-b-2 px-4 py-3.5 text-xs font-bold tracking-wide whitespace-nowrap uppercase transition-colors",
              active
                ? "border-primary text-primary"
                : "border-transparent text-slate-500 hover:text-primary",
            )}
          >
            {tab.label}
            <span
              className={cn(
                "min-w-6 rounded-full px-1.5 py-0.5 text-[11px] text-white tabular-nums",
                active ? "bg-primary" : "bg-slate-400",
              )}
            >
              {count ?? "…"}
            </span>
          </button>
        );
      })}
    </div>
  );
}
