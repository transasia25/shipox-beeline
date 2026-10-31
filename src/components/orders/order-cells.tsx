import { Clock3 } from "lucide-react";
import type { Party } from "@/lib/backend/types";
import { formatDateParts, formatStatusDate } from "@/lib/format";
import { orderStatusLabel } from "@/lib/labels";
import { cn } from "@/lib/utils";

/** Ячейки таблицы заказов в манере дашборда Shipox. */

const AVATAR_COLORS = ["#d6336c", "#8e44ad", "#43a047", "#1e88e5", "#f4511e", "#757575"];

function initials(name: string): string {
  const words = name.replace(/\(.*?\)/g, "").trim().split(/\s+/).filter(Boolean);
  const letters = words.length > 1 ? words[0][0] + words[1][0] : (words[0] ?? "?").slice(0, 1);
  return letters.toUpperCase();
}

/** Цвет кружка постоянен для одного имени: оператор узнаёт клиента взглядом. */
function avatarColor(name: string): string {
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export function RecipientCell({ party }: { party: Party | null }) {
  const name = party?.name ?? "—";
  return (
    <div className="flex items-center gap-3">
      <div
        className="flex size-10 shrink-0 items-center justify-center rounded-full text-base text-white"
        style={{ backgroundColor: avatarColor(name) }}
        aria-hidden
      >
        {initials(name)}
      </div>
      <div className="min-w-0 leading-snug">
        <div className="truncate font-medium">
          {name}
          {party?.phone && <span className="tabular-nums"> / {party.phone}</span>}
        </div>
        {party?.city && <div className="truncate">{party.city}</div>}
        {party?.address && <div className="max-w-72 truncate underline underline-offset-2">{party.address}</div>}
      </div>
    </div>
  );
}

export function ServiceCell({ service }: { service: string | null }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted">
        <Clock3 className="size-5 fill-[#1e88e5] text-white" />
      </div>
      <span className="text-xs font-bold uppercase">{service ?? "—"}</span>
    </div>
  );
}

export function DateCell({ iso }: { iso: string | null }) {
  const parts = formatDateParts(iso);
  if (!parts) return <span className="text-muted-foreground">—</span>;
  return (
    <div className="text-center leading-snug tabular-nums">
      <div>{parts.date}</div>
      <div>{parts.time}</div>
    </div>
  );
}

/** Статус — текстом и датой под ним; отменённый приглушён, как в Shipox. */
export function StatusCell({ status, date }: { status: string; date: string | null }) {
  const cancelled = status.toLowerCase().startsWith("cancel");
  return (
    <div className={cn("text-center leading-snug", cancelled && "text-muted-foreground")}>
      <div>{orderStatusLabel(status)}</div>
      {date && <div className="tabular-nums">{formatStatusDate(date)}</div>}
    </div>
  );
}
