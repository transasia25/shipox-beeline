/** Форматирование чисел и дат. Единый вид во всех таблицах и карточках. */

const numberFormatter = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 });

export function formatNumber(value: number): string {
  return numberFormatter.format(value);
}

const uzsFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** 150000 → «150,000.00 UZS» — как суммы в дашборде Shipox. */
export function formatUzs(value: number): string {
  return `${uzsFormatter.format(value)} UZS`;
}

const pad = (value: number) => String(value).padStart(2, "0");

/** ISO → «27/10/26» и «10:09» — две строки ячейки, как в таблице Shipox. */
export function formatDateParts(iso: string | null | undefined): { date: string; time: string } | null {
  if (!iso) return null;
  const d = new Date(iso);
  return {
    date: `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${String(d.getFullYear()).slice(2)}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  };
}

/** ISO → «27/10/2026 10:18» — дата статуса под его названием. */
export function formatStatusDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** ISO-строка → «07.09.2026 14:30». Пустое значение — прочерк. */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Для <input type="date"> — дата по местному времени. Срез ISO-строки дал бы
 * дату по UTC, и вечером поле показывало бы вчерашний день.
 */
export function toDateInputValue(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Склонение: plural(3, "заказ", "заказа", "заказов") → «заказа». */
export function plural(count: number, one: string, few: string, many: string): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}
