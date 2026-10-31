"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ErrorState } from "@/components/ui-kit/error-state";
import { PageHeader } from "@/components/ui-kit/page-header";
import { SelectField } from "@/components/ui-kit/select-field";
import { OrderStatusBadge } from "@/components/ui-kit/status-badge";
import { useBackend } from "@/hooks/use-backend";
import {
  getCancellationsSummary,
  getCreationsSummary,
  listCancellations,
  listCreations,
} from "@/lib/backend/client";
import type { CancelReason, CreationsPage, CreationsSummary } from "@/lib/backend/types";
import { formatDateTime, formatNumber, formatUzs, plural, toDateInputValue } from "@/lib/format";
import { cn } from "@/lib/utils";
import { CANCEL_REASON_LABEL } from "@/lib/labels";

const PAGE_SIZE = 50;

const REASON_OPTIONS = [
  { value: "", label: "Все причины" },
  ...(Object.keys(CANCEL_REASON_LABEL) as CancelReason[]).map((reason) => ({
    value: reason,
    label: CANCEL_REASON_LABEL[reason],
  })),
];

/** По умолчанию — с начала месяца по сегодня: так руководство смотрит итоги. */
function defaultPeriod() {
  const today = new Date();
  return {
    from: toDateInputValue(new Date(today.getFullYear(), today.getMonth(), 1)),
    to: toDateInputValue(today),
  };
}

/**
 * Журнал действий: кто, когда и почему отменил заказы — и кто какие создал.
 *
 * Сводка считает только подтверждённые Shipox отмены. Неподтверждённые — те,
 * на которые Shipox не ответил, — видны в журнале с отметкой: их стоит
 * перепроверить в карточке заказа.
 */
type Kind = "cancellations" | "creations";

export default function CancellationsPage() {
  const [kind, setKind] = useState<Kind>("cancellations");
  const [period, setPeriod] = useState(defaultPeriod);
  const [userId, setUserId] = useState("");
  const [reason, setReason] = useState<CancelReason | "">("");
  const [draft, setDraft] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);

  const summary = useBackend(() => getCancellationsSummary(period), [period]);
  const journal = useBackend(
    () => listCancellations({ ...period, userId, reason, search, page, size: PAGE_SIZE }),
    [period, userId, reason, search, page],
  );
  const creationsSummary = useBackend(() => getCreationsSummary(period), [period]);
  const creations = useBackend(
    () =>
      kind === "creations"
        ? listCreations({ ...period, userId, search, page, size: PAGE_SIZE })
        : Promise.resolve(null),
    [kind, period, userId, search, page],
  );

  // Фильтр по сотруднику — из тех, кто отменял за период: руководителю список
  // всех учёток не открыт, да и пустые строки в нём не нужны.
  const userOptions = useMemo(
    () => [
      { value: "", label: "Все сотрудники" },
      ...((kind === "cancellations" ? summary.data : creationsSummary.data)?.byUser ?? []).map((row) => ({
        value: row.userId,
        label: row.user?.name ?? row.userId,
      })),
    ],
    [kind, summary.data, creationsSummary.data],
  );

  const changePeriod = (next: Partial<typeof period>) => {
    setPeriod((current) => ({ ...current, ...next }));
    setPage(0);
  };

  const pages = journal.data ? Math.ceil(journal.data.total / PAGE_SIZE) : 0;

  const switchKind = (next: Kind) => {
    setKind(next);
    setUserId("");
    setPage(0);
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Журнал"
        description="Кто из сотрудников, когда и почему отменил заказы через кабинет — и кто какие заказы создал."
      />

      <div className="flex rounded-md bg-card shadow-sm">
        {(
          [
            ["cancellations", "Отменённые", summary.data?.total],
            ["creations", "Созданные", creationsSummary.data?.total],
          ] as const
        ).map(([key, label, count]) => (
          <button
            key={key}
            type="button"
            onClick={() => switchKind(key)}
            className={cn(
              "flex flex-1 items-center justify-center gap-2 border-b-2 py-3.5 text-xs font-bold tracking-wide uppercase",
              kind === key ? "border-primary text-primary" : "border-transparent text-slate-500 hover:text-primary",
            )}
          >
            {label}
            <span
              className={cn(
                "min-w-6 rounded-full px-1.5 py-0.5 text-[11px] text-white tabular-nums",
                kind === key ? "bg-primary" : "bg-slate-400",
              )}
            >
              {count ?? "…"}
            </span>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-md bg-card p-4 shadow-sm">
        <div className="space-y-1.5">
          <Label htmlFor="from">С</Label>
          <Input
            id="from"
            type="date"
            value={period.from}
            max={period.to}
            onChange={(event) => event.target.value && changePeriod({ from: event.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="to">По</Label>
          <Input
            id="to"
            type="date"
            value={period.to}
            min={period.from}
            onChange={(event) => event.target.value && changePeriod({ to: event.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Сотрудник</Label>
          <SelectField
            value={userId}
            onChange={(value) => {
              setUserId(value);
              setPage(0);
            }}
            options={userOptions}
            placeholder="Все сотрудники"
            className="min-w-48"
          />
        </div>
        {kind === "cancellations" && (
        <div className="space-y-1.5">
          <Label>Причина</Label>
          <SelectField
            value={reason}
            onChange={(value) => {
              setReason(value as CancelReason | "");
              setPage(0);
            }}
            options={REASON_OPTIONS}
            placeholder="Все причины"
            className="min-w-56"
          />
        </div>
        )}
        <form
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            setSearch(draft.trim());
            setPage(0);
          }}
        >
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Номер заказа, номер Beeline или телефон"
              className="w-60 pl-8"
            />
          </div>
          <Button type="submit" variant="outline">
            Найти
          </Button>
        </form>
      </div>

      {kind === "creations" ? (
        <CreationsView
          summary={creationsSummary}
          journal={creations}
          page={page}
          setPage={setPage}
        />
      ) : (
      <>
      {summary.error ? (
        <ErrorState message={summary.error} onRetry={summary.reload} />
      ) : !summary.data ? (
        <Skeleton className="h-40" />
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm text-muted-foreground">Отменено за период</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              <div className="text-3xl font-semibold tabular-nums">
                {formatNumber(summary.data.total)}
              </div>
              {summary.data.pending > 0 && (
                <p className="text-sm text-amber-700 dark:text-amber-300">
                  и {summary.data.pending}{" "}
                  {plural(summary.data.pending, "отмена", "отмены", "отмен")} без подтверждения Shipox
                </p>
              )}
            </CardContent>
          </Card>
          <BreakdownCard
            title="По сотрудникам"
            rows={summary.data.byUser.map((row) => ({
              key: row.userId,
              label: row.user?.name ?? "—",
              hint: row.user && !row.user.active ? "отключён" : undefined,
              count: row.count,
            }))}
            total={summary.data.total}
          />
          <BreakdownCard
            title="По причинам"
            rows={summary.data.byReason.map((row) => ({
              key: row.reason,
              label: CANCEL_REASON_LABEL[row.reason],
              count: row.count,
            }))}
            total={summary.data.total}
          />
        </div>
      )}

      {journal.error ? (
        <ErrorState message={journal.error} onRetry={journal.reload} />
      ) : !journal.data ? (
        <Skeleton className="h-96" />
      ) : (
        <div className="space-y-3">
          <div className="overflow-x-auto rounded-md bg-card shadow-sm">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Когда</TableHead>
                  <TableHead>Сотрудник</TableHead>
                  <TableHead>Заказ</TableHead>
                  <TableHead>Получатель</TableHead>
                  <TableHead>Статус до отмены</TableHead>
                  <TableHead>Причина</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {journal.data.items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-28 text-center text-muted-foreground">
                      За выбранный период отмен нет
                    </TableCell>
                  </TableRow>
                ) : (
                  journal.data.items.map((row) => (
                    <TableRow key={row.id} className="even:bg-row-stripe">
                      <TableCell className="whitespace-nowrap tabular-nums">
                        {formatDateTime(row.createdAt)}
                        {row.result === "PENDING" && (
                          <Badge variant="outline" className="ml-2" title={row.errorMessage ?? undefined}>
                            Не подтверждена
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div>{row.user.name}</div>
                        <div className="text-xs text-muted-foreground">{row.user.login}</div>
                      </TableCell>
                      <TableCell>
                        <Link
                          href={`/orders/${encodeURIComponent(row.shipoxOrderId)}`}
                          className="font-medium text-order-number tabular-nums hover:underline"
                        >
                          {row.orderNumber}
                        </Link>
                        {row.referenceId && (
                          <div className="text-xs text-muted-foreground">{row.referenceId}</div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div>{row.recipientName ?? "—"}</div>
                        <div className="text-xs text-muted-foreground tabular-nums">
                          {row.recipientPhone}
                        </div>
                      </TableCell>
                      <TableCell>
                        <OrderStatusBadge status={row.statusBefore} />
                      </TableCell>
                      <TableCell className="max-w-72">
                        <div>{CANCEL_REASON_LABEL[row.reason]}</div>
                        {row.comment && (
                          <div className="text-xs whitespace-normal text-muted-foreground">
                            {row.comment}
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
            <div>
              {formatNumber(journal.data.total)}{" "}
              {plural(journal.data.total, "запись", "записи", "записей")}
            </div>
            {pages > 1 && (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((value) => value - 1)}
                  disabled={page === 0}
                >
                  Назад
                </Button>
                <span className="tabular-nums">
                  {page + 1} / {pages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((value) => value + 1)}
                  disabled={page + 1 >= pages}
                >
                  Вперёд
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
      </>
      )}
    </div>
  );
}

/** Созданные через кабинет заказы: сводка по сотрудникам и сам журнал. */
function CreationsView({
  summary,
  journal,
  page,
  setPage,
}: {
  summary: { data: CreationsSummary | null; error: string | null; reload: () => void };
  journal: { data: CreationsPage | null; error: string | null; reload: () => void };
  page: number;
  setPage: (update: (value: number) => number) => void;
}) {
  const pages = journal.data ? Math.ceil(journal.data.total / PAGE_SIZE) : 0;
  return (
    <>
      {summary.error ? (
        <ErrorState message={summary.error} onRetry={summary.reload} />
      ) : !summary.data ? (
        <Skeleton className="h-40" />
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm text-muted-foreground">Создано за период</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              <div className="text-3xl font-semibold tabular-nums">{formatNumber(summary.data.total)}</div>
              {summary.data.pending > 0 && (
                <p className="text-sm text-amber-700 dark:text-amber-300">
                  и {summary.data.pending} без ответа Shipox — проверьте поиском по номеру
                </p>
              )}
            </CardContent>
          </Card>
          <div className="lg:col-span-2">
            <BreakdownCard
              title="По сотрудникам"
              rows={summary.data.byUser.map((row) => ({
                key: row.userId,
                label: row.user?.name ?? "—",
                hint: row.user && !row.user.active ? "отключён" : undefined,
                count: row.count,
              }))}
              total={summary.data.total}
            />
          </div>
        </div>
      )}

      {journal.error ? (
        <ErrorState message={journal.error} onRetry={journal.reload} />
      ) : !journal.data ? (
        <Skeleton className="h-96" />
      ) : (
        <div className="space-y-3">
          <div className="overflow-x-auto rounded-md bg-card shadow-sm">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Когда</TableHead>
                  <TableHead>Сотрудник</TableHead>
                  <TableHead>Заказ</TableHead>
                  <TableHead>Откуда</TableHead>
                  <TableHead>Получатель</TableHead>
                  <TableHead>Город</TableHead>
                  <TableHead>Услуга</TableHead>
                  <TableHead className="text-right">Наложенный платёж</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {journal.data.items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-28 text-center text-muted-foreground">
                      За выбранный период заказов через кабинет не создавали
                    </TableCell>
                  </TableRow>
                ) : (
                  journal.data.items.map((row) => (
                    <TableRow key={row.id} className="even:bg-row-stripe">
                      <TableCell className="whitespace-nowrap tabular-nums">
                        {formatDateTime(row.createdAt)}
                        {row.result === "PENDING" && (
                          <Badge variant="outline" className="ml-2" title={row.errorMessage ?? undefined}>
                            Без ответа Shipox
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div>{row.user.name}</div>
                        <div className="text-xs text-muted-foreground">{row.user.login}</div>
                      </TableCell>
                      <TableCell>
                        {row.shipoxOrderId ? (
                          <Link
                            href={`/orders/${encodeURIComponent(row.shipoxOrderId)}`}
                            className="font-medium text-order-number tabular-nums hover:underline"
                          >
                            {row.orderNumber}
                          </Link>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                        <div className="text-xs text-muted-foreground">{row.referenceId}</div>
                      </TableCell>
                      <TableCell className="max-w-56 text-xs whitespace-normal">
                        {row.fromAddress ?? "—"}
                      </TableCell>
                      <TableCell>
                        <div>{row.recipientName}</div>
                        <div className="text-xs text-muted-foreground tabular-nums">{row.recipientPhone}</div>
                      </TableCell>
                      <TableCell>{row.city}</TableCell>
                      <TableCell className="text-xs font-bold uppercase">{row.service}</TableCell>
                      <TableCell className="text-right whitespace-nowrap tabular-nums">
                        {row.codAmount ? formatUzs(Number(row.codAmount)) : "—"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
            <div>
              {formatNumber(journal.data.total)} {plural(journal.data.total, "запись", "записи", "записей")}
            </div>
            {pages > 1 && (
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setPage((value) => value - 1)} disabled={page === 0}>
                  Назад
                </Button>
                <span className="tabular-nums">
                  {page + 1} / {pages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((value) => value + 1)}
                  disabled={page + 1 >= pages}
                >
                  Вперёд
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

/** Разбивка итога: строка — имя, полоса доли и число. */
function BreakdownCard({
  title,
  rows,
  total,
}: {
  title: string;
  rows: { key: string; label: string; hint?: string; count: number }[];
  total: number;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">Отмен нет</p>
        ) : (
          <ul className="space-y-2">
            {rows.slice(0, 6).map((row) => (
              <li key={row.key} className="space-y-1 text-sm">
                <div className="flex justify-between gap-2">
                  <span className="truncate">
                    {row.label}
                    {row.hint && <span className="ml-1 text-xs text-muted-foreground">({row.hint})</span>}
                  </span>
                  <span className="font-medium tabular-nums">{formatNumber(row.count)}</span>
                </div>
                <div className="h-1.5 rounded-full bg-muted">
                  <div
                    className="h-1.5 rounded-full bg-primary"
                    style={{ width: `${total ? Math.max(2, (row.count / total) * 100) : 0}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
