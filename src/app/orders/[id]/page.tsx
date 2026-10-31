"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState, type ReactNode } from "react";
import { ArrowLeft, Ban, RefreshCw, UserRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CancelOrderDialog } from "@/components/orders/cancel-dialog";
import { ErrorState } from "@/components/ui-kit/error-state";
import { OrderStatusBadge } from "@/components/ui-kit/status-badge";
import { useBackend } from "@/hooks/use-backend";
import { getOrder } from "@/lib/backend/client";
import type { Cancellation, Creation, Party } from "@/lib/backend/types";
import { formatDateTime, formatUzs } from "@/lib/format";
import { CANCEL_REASON_LABEL } from "@/lib/labels";

export default function OrderPage() {
  const { id } = useParams<{ id: string }>();
  const detail = useBackend(() => getOrder(id), [id]);
  const [cancelling, setCancelling] = useState(false);

  const back = (
    <Link
      href="/orders"
      className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="size-4" />К списку заказов
    </Link>
  );

  if (detail.error) {
    return (
      <div className="space-y-4">
        {back}
        <ErrorState message={detail.error} onRetry={detail.reload} />
      </div>
    );
  }
  if (!detail.data) {
    return (
      <div className="space-y-4">
        {back}
        <Skeleton className="h-10 w-80" />
        <Skeleton className="h-72" />
      </div>
    );
  }

  const { order, history, cancellation, creation } = detail.data;

  return (
    <div className="space-y-5">
      {back}

      <div className="flex flex-wrap items-start justify-between gap-3 rounded-md bg-card p-4 shadow-sm">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-medium">
              Заказ <span className="text-order-number tabular-nums">{order.orderNumber}</span>
            </h1>
            <OrderStatusBadge status={order.status} />
          </div>
          <p className="text-sm text-muted-foreground">
            {order.referenceId ? `${order.referenceId} · ` : ""}создан {formatDateTime(order.createdAt)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={detail.reload} disabled={detail.loading}>
            <RefreshCw className={detail.loading ? "size-4 animate-spin" : "size-4"} />
            Обновить
          </Button>
          {order.cancellable && (
            <Button variant="destructive" size="sm" onClick={() => setCancelling(true)}>
              <Ban className="size-4" />
              Отменить заказ
            </Button>
          )}
        </div>
      </div>

      {cancellation && <CancellationNote cancellation={cancellation} />}
      {creation && <CreationNote creation={creation} />}

      <div className="grid gap-4 lg:grid-cols-2">
        <PartyCard title="Получатель" party={order.recipient} />
        <PartyCard title="Отправитель" party={order.sender} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Посылка</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Наложенный платёж">
              {order.codAmount ? formatUzs(order.codAmount) : "нет"}
            </Field>
            <Field label="Стоимость доставки">
              {order.deliveryCost !== null ? formatUzs(order.deliveryCost) : "—"}
            </Field>
            <Field label="Объявленная стоимость">
              {order.parcelValue !== null ? formatUzs(order.parcelValue) : "—"}
            </Field>
            <Field label="Услуга">{order.service ?? "—"}</Field>
            <Field label="Мест">{order.pieceCount ?? "—"}</Field>
            <Field label="Вес">{order.weight !== null ? `${order.weight} кг` : "—"}</Field>
            <Field label="Статус изменён">{formatDateTime(order.statusChangedAt)}</Field>
            {order.note && <Field label="Описание">{order.note}</Field>}
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">История статусов</CardTitle>
        </CardHeader>
        <CardContent>
          {history === null ? (
            <p className="text-sm text-muted-foreground">
              Shipox не отдал историю — статус заказа выше актуален.
            </p>
          ) : history.length === 0 ? (
            <p className="text-sm text-muted-foreground">Истории пока нет.</p>
          ) : (
            <ol className="space-y-3">
              {/* Порядок задаём сами: свежее сверху, как бы ни отдал Shipox. */}
              {[...history]
                .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""))
                .map((item, index) => (
                <li key={`${item.status}-${item.date}-${index}`} className="flex gap-3 text-sm">
                  <span className="w-36 shrink-0 text-muted-foreground tabular-nums">
                    {formatDateTime(item.date)}
                  </span>
                  <div className="space-y-0.5">
                    <OrderStatusBadge status={item.status} />
                    {item.note && <div className="text-muted-foreground">{item.note}</div>}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>

      <CancelOrderDialog
        order={cancelling ? order : null}
        onClose={() => setCancelling(false)}
        onCancelled={detail.reload}
      />
    </div>
  );
}

/** Кто отменил заказ через кабинет — видно сразу, без похода в журнал. */
function CancellationNote({ cancellation }: { cancellation: Cancellation }) {
  const pending = cancellation.result === "PENDING";
  return (
    <div className="flex items-start gap-3 rounded-md border-l-4 border-destructive bg-card p-3 text-sm shadow-sm">
      <UserRound className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <div className="space-y-0.5">
        <div>
          {pending ? "Отменяет" : "Отменил"} <span className="font-medium">{cancellation.user.name}</span>{" "}
          · {formatDateTime(cancellation.createdAt)}
          {pending && (
            <Badge variant="outline" className="ml-2">
              Shipox ещё не подтвердил
            </Badge>
          )}
        </div>
        <div className="text-muted-foreground">
          {CANCEL_REASON_LABEL[cancellation.reason]}
          {cancellation.comment ? ` — ${cancellation.comment}` : ""}
        </div>
      </div>
    </div>
  );
}

/** Заказ заведён через кабинет — видно, кто именно. */
function CreationNote({ creation }: { creation: Creation }) {
  return (
    <div className="flex items-start gap-3 rounded-md border-l-4 border-primary bg-card p-3 text-sm shadow-sm">
      <UserRound className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <div>
        Создал <span className="font-medium">{creation.user.name}</span> · {formatDateTime(creation.createdAt)}
      </div>
    </div>
  );
}

function PartyCard({ title, party }: { title: string; party: Party | null }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {party ? (
          <dl className="space-y-2 text-sm">
            <Field label="Имя">{party.name ?? "—"}</Field>
            <Field label="Телефон">
              {party.phone ? (
                <a href={`tel:${party.phone}`} className="tabular-nums hover:underline">
                  {party.phone}
                </a>
              ) : (
                "—"
              )}
            </Field>
            <Field label="Адрес">
              {[party.city, party.address].filter(Boolean).join(", ") || "—"}
            </Field>
          </dl>
        ) : (
          <p className="text-sm text-muted-foreground">Shipox не передал данные.</p>
        )}
      </CardContent>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}
