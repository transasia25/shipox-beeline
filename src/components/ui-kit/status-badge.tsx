import { Badge } from "@/components/ui/badge";
import { orderStatusLabel, orderStatusTone, type StatusTone } from "@/lib/labels";
import { cn } from "@/lib/utils";

const TONE_CLASS: Record<StatusTone, string> = {
  active: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200",
  done: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
  cancelled: "bg-muted text-muted-foreground",
  problem: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
};

/** Статус заказа Shipox: подпись по-русски, цвет — по смыслу. */
export function OrderStatusBadge({ status, className }: { status: string; className?: string }) {
  return (
    <Badge variant="ghost" className={cn(TONE_CLASS[orderStatusTone(status)], className)} title={status}>
      {orderStatusLabel(status)}
    </Badge>
  );
}
