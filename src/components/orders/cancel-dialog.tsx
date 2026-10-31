"use client";

import { useState } from "react";
import { Ban } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { SelectField } from "@/components/ui-kit/select-field";
import { OrderStatusBadge } from "@/components/ui-kit/status-badge";
import { ApiError, cancelOrder } from "@/lib/backend/client";
import type { CancelReason, Order } from "@/lib/backend/types";
import { CANCEL_REASON_LABEL } from "@/lib/labels";
import { cn } from "@/lib/utils";

const REASON_OPTIONS = (Object.keys(CANCEL_REASON_LABEL) as CancelReason[]).map((reason) => ({
  value: reason,
  label: CANCEL_REASON_LABEL[reason],
}));

/**
 * Подтверждение отмены.
 *
 * Причина обязательна: руководство видит её в журнале рядом с именем
 * оператора. Для «Другое» нужен ещё и комментарий — иначе «другое» ничего
 * не объясняет.
 */
export function CancelOrderDialog({
  order,
  onClose,
  onCancelled,
}: {
  order: Order | null;
  onClose: () => void;
  /** Вызывается и при отказе «уже отменён» — экрану в любом случае пора обновиться. */
  onCancelled: () => void;
}) {
  const [reason, setReason] = useState<CancelReason | "">("");
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const needsComment = reason === "OTHER";
  const ready = reason !== "" && (!needsComment || comment.trim().length > 0);

  const close = () => {
    setReason("");
    setComment("");
    setError(null);
    onClose();
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!order || !reason) return;
    setBusy(true);
    setError(null);
    try {
      await cancelOrder(order.id, { reason, comment: comment.trim() || undefined });
      toast.success(`Заказ ${order.orderNumber} отменён`);
      close();
      onCancelled();
    } catch (failure) {
      const message = failure instanceof Error ? failure.message : "Отменить не удалось";
      setError(message);
      // 409 — заказ уже отменён или его отменяет коллега; 502 — исход
      // неизвестен. В обоих случаях список должен показать свежий статус.
      if (failure instanceof ApiError && (failure.status === 409 || failure.status === 502)) {
        onCancelled();
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={order !== null} onOpenChange={(open) => !open && !busy && close()}>
      <DialogContent className="sm:max-w-md">
        <DialogTitle className="flex items-center gap-2">
          <Ban className="size-4 text-destructive" />
          Отменить заказ {order?.orderNumber}?
        </DialogTitle>
        <DialogDescription>
          Отмена уходит в Shipox сразу, вернуть заказ из кабинета нельзя.
        </DialogDescription>

        {order && (
          <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium">{order.recipient?.name ?? "Получатель не указан"}</span>
              <OrderStatusBadge status={order.status} />
            </div>
            <div className="mt-1 text-muted-foreground">
              {[order.recipient?.phone, order.recipient?.city, order.referenceId]
                .filter(Boolean)
                .join(" · ")}
            </div>
          </div>
        )}

        <form onSubmit={submit} className="space-y-3 pt-1">
          <div className="space-y-1.5">
            <Label>Причина</Label>
            <SelectField
              value={reason}
              onChange={(value) => setReason(value as CancelReason)}
              placeholder="Выберите причину"
              options={REASON_OPTIONS}
              className="w-full"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cancel-comment">
              Комментарий{needsComment ? "" : " — по желанию"}
            </Label>
            <textarea
              id="cancel-comment"
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              maxLength={500}
              rows={3}
              placeholder={needsComment ? "Почему отменяется заказ" : "Например: клиент перезвонит позже"}
              className={cn(
                "w-full resize-none rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm outline-none",
                "placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
              )}
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={close} disabled={busy}>
              Не отменять
            </Button>
            <Button type="submit" variant="destructive" disabled={busy || !ready}>
              {busy ? "Отменяю…" : "Отменить заказ"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
