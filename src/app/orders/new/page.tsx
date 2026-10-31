"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { ArrowLeft, Check, MapPinned, PackagePlus, Undo2, Warehouse } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { CityCombobox } from "@/components/orders/city-combobox";
import { ErrorState } from "@/components/ui-kit/error-state";
import { SelectField } from "@/components/ui-kit/select-field";
import { useBackend } from "@/hooks/use-backend";
import { useDebounced } from "@/hooks/use-debounced";
import { createOrder, getSender, listCities, listServices } from "@/lib/backend/client";
import type { CreateOrderBody, Payer, PaymentType, RecipientNotAvailable } from "@/lib/backend/types";
import { formatNumber, formatUzs } from "@/lib/format";
import { PAYER_LABEL, PAYMENT_TYPE_LABEL, RECIPIENT_NOT_AVAILABLE_LABEL } from "@/lib/labels";
import { cn } from "@/lib/utils";

/** Тариф Beeline — «от двери до двери»: код типа курьера в Shipox. */
const DEFAULT_COURIER_TYPE = "04";

/** Варианты выпадающего списка из словаря подписей. */
function optionsOf<T extends string>(labels: Record<T, string>) {
  return (Object.keys(labels) as T[]).map((value) => ({ value, label: labels[value] }));
}

const PAYMENT_TYPE_OPTIONS = optionsOf(PAYMENT_TYPE_LABEL);
const PAYER_OPTIONS = optionsOf(PAYER_LABEL);
const RECIPIENT_NOT_AVAILABLE_OPTIONS = optionsOf(RECIPIENT_NOT_AVAILABLE_LABEL);

/**
 * Номер заказа по умолчанию. Создаётся один раз на форму и не меняется при
 * повторной отправке: если Shipox не ответил, второе нажатие найдёт уже
 * созданный заказ по этому номеру, а не заведёт дубль.
 */
function newReference(): string {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  const random = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `BPK-${String(now.getFullYear()).slice(2)}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${random}`;
}

/** Число из поля ввода: пусто — `undefined`, запятая — как точка. */
function toNumber(value: string): number | undefined {
  const parsed = Number.parseFloat(value.replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : undefined;
}

/** Телефон в +998XXXXXXXXX — так же, как приводит бэкенд. */
function normalizePhone(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (digits.length === 9) return `+998${digits}`;
  if (digits.length === 12 && digits.startsWith("998")) return `+${digits}`;
  return value.trim();
}

export default function NewOrderPage() {
  const router = useRouter();
  const sender = useBackend(() => getSender(), []);
  const cities = useBackend(() => listCities(), []);

  const [referenceId, setReferenceId] = useState(newReference);
  const [recipientName, setRecipientName] = useState("");
  const [recipientPhone, setRecipientPhone] = useState("");
  const [cityId, setCityId] = useState("");
  // Адрес одной строкой — улица, дом, квартира, ориентир — как его диктует клиент.
  const [street, setStreet] = useState("");
  const [weight, setWeight] = useState("1");
  const [length, setLength] = useState("");
  const [width, setWidth] = useState("");
  const [height, setHeight] = useState("");
  const [pieceCount, setPieceCount] = useState("1");
  const [codAmount, setCodAmount] = useState("");
  const [parcelValue, setParcelValue] = useState("");
  // По умолчанию — как было до выбора: Beeline платит со своего баланса.
  const [pickedPaymentType, setPaymentType] = useState<PaymentType>("credit_balance");
  const [payer, setPayer] = useState<Payer>("sender");
  const [pickedRecipientNotAvailable, setRecipientNotAvailable] =
    useState<RecipientNotAvailable>("do_not_deliver");
  const [note, setNote] = useState("");
  const [fragile, setFragile] = useState(false);
  const [pickedServiceKey, setServiceKey] = useState("");
  // Откуда: по умолчанию склад Beeline. Другой адрес заполняется от склада,
  // чтобы оператору оставалось поменять только то, что отличается.
  const [customPickup, setCustomPickup] = useState(false);
  const [senderCityId, setSenderCityId] = useState("");
  const [senderStreet, setSenderStreet] = useState("");
  const [senderName, setSenderName] = useState("");
  const [senderPhone, setSenderPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);

  const fromCityId = customPickup && senderCityId ? senderCityId : undefined;
  // Тариф зависит от веса и габаритов: пересчитываем после паузы во вводе.
  // Строкой, а не объектом: новый объект на каждом рендере сбрасывал бы паузу.
  const parcelKey = useDebounced(JSON.stringify([weight, length, width, height]));
  const [parcelWeightText, parcelLength, parcelWidth, parcelHeight] = (
    JSON.parse(parcelKey) as string[]
  ).map(toNumber);
  const parcel = {
    weight: parcelWeightText,
    length: parcelLength,
    width: parcelWidth,
    height: parcelHeight,
  };
  const parcelWeight = parcel.weight && parcel.weight > 0 ? parcel.weight : 1;
  const services = useBackend(
    () =>
      cityId
        ? listServices({
            cityId,
            fromCityId,
            weight: parcelWeight,
            length: parcel.length,
            width: parcel.width,
            height: parcel.height,
          })
        : Promise.resolve([]),
    [cityId, fromCityId, parcelWeight, parcel.length, parcel.width, parcel.height],
  );

  // Вариант — услуга с конкретным правилом цены: у одной услуги их бывает
  // несколько. Пока оператор сам не выбрал, стоит первый вариант тарифа Beeline
  // («от двери до двери»). Выбор, которого нет для нового маршрута, не держим.
  const serviceList = cityId ? (services.data ?? []) : [];
  const chosenService =
    serviceList.find((item) => item.key === pickedServiceKey) ??
    serviceList.find((item) => item.courierType === DEFAULT_COURIER_TYPE);
  const serviceId = chosenService?.id ?? "";

  const phone = normalizePhone(recipientPhone);
  const pickupPhone = normalizePhone(senderPhone);
  const cod = toNumber(codAmount);

  // Получатель платит курьеру наличными. С кредитным балансом Shipox ничего с
  // него не берёт (так видно на живых заказах), и выбор «получатель» теряет смысл.
  const paymentType = payer === "recipient" ? "cash" : pickedPaymentType;
  // С получателя берут деньги — Shipox не даст оставить посылку без него.
  const collectsCash = (cod ?? 0) > 0 || payer === "recipient";
  const recipientNotAvailable = collectsCash ? "do_not_deliver" : pickedRecipientNotAvailable;

  const problems = {
    recipientName: recipientName.trim().length < 2,
    recipientPhone: !/^\+998\d{9}$/.test(phone),
    cityId: !cityId,
    street: street.trim().length < 3,
    weight: !(toNumber(weight) && toNumber(weight)! > 0),
    serviceId: !serviceId,
    referenceId: !/^[\w./-]{1,60}$/.test(referenceId.trim()),
    senderCityId: customPickup && !senderCityId,
    senderStreet: customPickup && senderStreet.trim().length < 3,
    senderName: customPickup && senderName.trim().length < 2,
    senderPhone: customPickup && !/^\+998\d{9}$/.test(pickupPhone),
  };
  const ready = !Object.values(problems).some(Boolean);
  const show = (field: keyof typeof problems) => touched && problems[field];

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setTouched(true);
    if (!ready) return;
    setBusy(true);
    setError(null);
    const body: CreateOrderBody = {
      recipientName: recipientName.trim(),
      recipientPhone: phone,
      cityId,
      street: street.trim(),
      serviceId,
      ruleId: chosenService?.ruleId ?? undefined,
      weight: toNumber(weight)!,
      length: toNumber(length),
      width: toNumber(width),
      height: toNumber(height),
      pieceCount: toNumber(pieceCount) ? Math.round(toNumber(pieceCount)!) : undefined,
      codAmount: cod && cod > 0 ? cod : undefined,
      parcelValue: toNumber(parcelValue),
      paymentType,
      payer,
      recipientNotAvailable,
      ...(customPickup
        ? {
            senderCityId,
            senderStreet: senderStreet.trim(),
            senderName: senderName.trim(),
            senderPhone: pickupPhone,
          }
        : {}),
      note: note.trim() || undefined,
      fragile,
      referenceId: referenceId.trim(),
    };
    try {
      const result = await createOrder(body);
      if (result.created) toast.success(`Заказ ${result.order.orderNumber} создан`);
      else toast.info(`Заказ с номером ${body.referenceId} уже был — открываю его`);
      router.push(`/orders/${encodeURIComponent(result.order.id)}`);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Создать заказ не удалось");
      setBusy(false);
    }
  };

  if (cities.error || sender.error) {
    return <ErrorState message={(cities.error ?? sender.error)!} onRetry={() => { cities.reload(); sender.reload(); }} />;
  }
  if (!cities.data || !sender.data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-[32rem]" />
      </div>
    );
  }

  const chosenCity = cities.data.find((item) => item.id === cityId);
  const pickupCity = customPickup
    ? cities.data.find((item) => item.id === senderCityId)?.name
    : sender.data.city;

  const startCustomPickup = () => {
    setSenderCityId(sender.data!.cityId);
    setSenderStreet(sender.data!.street);
    setSenderName(sender.data!.name);
    setSenderPhone(sender.data!.phone);
    setCustomPickup(true);
  };

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <Link
        href="/orders"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />К списку заказов
      </Link>
      <h1 className="text-xl font-medium">Новый заказ</h1>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-4">
          <Panel
            title="Откуда"
            action={
              customPickup ? (
                <Button type="button" variant="ghost" size="sm" onClick={() => setCustomPickup(false)}>
                  <Undo2 className="size-4" />
                  Вернуть склад Beeline
                </Button>
              ) : (
                <Button type="button" variant="outline" size="sm" onClick={startCustomPickup}>
                  <MapPinned className="size-4" />
                  Забрать с другого адреса
                </Button>
              )
            }
          >
            {customPickup ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Контакт на месте" invalid={show("senderName")} hint="Кто отдаст посылку">
                  <Input
                    value={senderName}
                    onChange={(event) => setSenderName(event.target.value)}
                    placeholder="Пункт Beeline на Чиланзаре"
                    aria-invalid={show("senderName") || undefined}
                  />
                </Field>
                <Field label="Телефон" invalid={show("senderPhone")} hint="+998 и девять цифр">
                  <Input
                    value={senderPhone}
                    onChange={(event) => setSenderPhone(event.target.value)}
                    onBlur={() => setSenderPhone((value) => (value ? normalizePhone(value) : value))}
                    inputMode="tel"
                    aria-invalid={show("senderPhone") || undefined}
                  />
                </Field>
                <Field label="Город" invalid={show("senderCityId")} hint="Выберите город из списка">
                  <CityCombobox
                    cities={cities.data}
                    value={senderCityId}
                    onChange={setSenderCityId}
                    invalid={show("senderCityId")}
                  />
                </Field>
                <Field label="Адрес" invalid={show("senderStreet")} hint="Укажите адрес забора">
                  <Input
                    value={senderStreet}
                    onChange={(event) => setSenderStreet(event.target.value)}
                    aria-invalid={show("senderStreet") || undefined}
                  />
                </Field>
              </div>
            ) : (
              <div className="flex items-start gap-3 text-sm">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <Warehouse className="size-4" />
                </div>
                <div className="leading-snug">
                  <div className="font-medium">{sender.data.name}</div>
                  <div>{sender.data.phone}</div>
                  <div className="text-muted-foreground">
                    {sender.data.city}, {sender.data.street}
                  </div>
                </div>
              </div>
            )}
          </Panel>

          <Panel title="Получатель">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Имя и фамилия" invalid={show("recipientName")} hint="Укажите получателя">
                <Input
                  value={recipientName}
                  onChange={(event) => setRecipientName(event.target.value)}
                  placeholder="Алиев Тимур"
                  autoFocus
                  aria-invalid={show("recipientName") || undefined}
                />
              </Field>
              <Field label="Телефон" invalid={show("recipientPhone")} hint="+998 и девять цифр">
                <Input
                  value={recipientPhone}
                  onChange={(event) => setRecipientPhone(event.target.value)}
                  onBlur={() => setRecipientPhone((value) => (value ? normalizePhone(value) : value))}
                  placeholder="+998 90 123 45 67"
                  inputMode="tel"
                  aria-invalid={show("recipientPhone") || undefined}
                />
              </Field>
            </div>
          </Panel>

          <Panel title="Адрес доставки">
            <div className="grid gap-3 sm:grid-cols-[minmax(0,16rem)_minmax(0,1fr)]">
              <Field label="Город" invalid={show("cityId")} hint="Выберите город из списка">
                <CityCombobox
                  cities={cities.data}
                  value={cityId}
                  onChange={setCityId}
                  invalid={show("cityId")}
                />
              </Field>
              <Field label="Адрес" invalid={show("street")} hint="Укажите адрес доставки">
                <Input
                  value={street}
                  onChange={(event) => setStreet(event.target.value)}
                  placeholder="ул. Навои, 12, кв. 45, напротив школы № 5"
                  aria-invalid={show("street") || undefined}
                />
              </Field>
            </div>
          </Panel>

          <Panel title="Посылка">
            <div className="grid gap-3 sm:grid-cols-4">
              <Field label="Вес, кг" invalid={show("weight")} hint="Больше нуля">
                <Input
                  value={weight}
                  onChange={(event) => setWeight(event.target.value)}
                  inputMode="decimal"
                  aria-invalid={show("weight") || undefined}
                />
              </Field>
              <Field label="Длина, см">
                <Input value={length} onChange={(event) => setLength(event.target.value)} inputMode="decimal" placeholder="10" />
              </Field>
              <Field label="Ширина, см">
                <Input value={width} onChange={(event) => setWidth(event.target.value)} inputMode="decimal" placeholder="10" />
              </Field>
              <Field label="Высота, см">
                <Input value={height} onChange={(event) => setHeight(event.target.value)} inputMode="decimal" placeholder="10" />
              </Field>
              <Field label="Мест">
                <Input value={pieceCount} onChange={(event) => setPieceCount(event.target.value)} inputMode="numeric" />
              </Field>
              <div className="sm:col-span-3">
                <Field label="Что внутри">
                  <Input value={note} onChange={(event) => setNote(event.target.value)} placeholder="Роутер Beeline" />
                </Field>
              </div>
            </div>
            <label className="mt-3 flex items-center gap-2 text-sm">
              <Switch checked={fragile} onCheckedChange={setFragile} />
              Хрупкое
            </label>
          </Panel>

          <Panel title="Оплата">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Способ оплаты">
                <SelectField
                  value={paymentType}
                  onChange={(value) => setPaymentType(value as PaymentType)}
                  options={PAYMENT_TYPE_OPTIONS}
                  disabled={payer === "recipient"}
                  className="w-full"
                />
              </Field>
              <Field label="Доставку оплачивает">
                <SelectField
                  value={payer}
                  onChange={(value) => setPayer(value as Payer)}
                  options={PAYER_OPTIONS}
                  className="w-full"
                />
              </Field>
              <Field label="Наложенный платёж, сум">
                <Input
                  value={codAmount}
                  onChange={(event) => setCodAmount(event.target.value)}
                  inputMode="decimal"
                  placeholder="0 — без оплаты при получении"
                />
              </Field>
              <Field label="Объявленная стоимость, сум">
                <Input
                  value={parcelValue}
                  onChange={(event) => setParcelValue(event.target.value)}
                  inputMode="decimal"
                  placeholder="по умолчанию — как наложенный платёж"
                />
              </Field>
              <div className="sm:col-span-2">
                <Field label="Если получатель недоступен">
                  <SelectField
                    value={recipientNotAvailable}
                    onChange={(value) => setRecipientNotAvailable(value as RecipientNotAvailable)}
                    options={RECIPIENT_NOT_AVAILABLE_OPTIONS}
                    disabled={collectsCash}
                    className="w-full"
                  />
                </Field>
              </div>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Стоимость доставки — тариф выбранной услуги. Shipox проставит её в заказ
              {paymentType === "credit_balance" ? " и спишет с баланса Beeline" : ""}.
              {payer === "recipient" ? " Получатель оплатит доставку курьеру наличными." : ""}
              {collectsCash ? " Курьер берёт с получателя деньги, поэтому без него посылку не оставит." : ""}
            </p>
          </Panel>
        </div>

        <div className="space-y-4 lg:sticky lg:top-20">
          <Panel title="Услуга">
            {!cityId ? (
              <p className="text-sm text-muted-foreground">Выберите город — покажу доступные услуги.</p>
            ) : services.error ? (
              <ErrorState message={services.error} onRetry={services.reload} />
            ) : !services.data || (services.loading && services.data.length === 0) ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, index) => (
                  <Skeleton key={index} className="h-12" />
                ))}
              </div>
            ) : (services.data ?? []).length === 0 ? (
              <p className="text-sm text-destructive">
                На этом маршруте у Beeline нет фиксированного тарифа в Shipox.
              </p>
            ) : (
              <div
                className={cn("space-y-2 transition-opacity", services.loading && "opacity-60")}
                role="radiogroup"
                aria-busy={services.loading}
              >
                {(services.data ?? []).map((service) => {
                  const active = service.key === chosenService?.key;
                  // Номер варианта среди тарифов той же услуги — чтобы отличать их.
                  const siblings = (services.data ?? []).filter((item) => item.id === service.id);
                  const variant = siblings.length > 1 ? siblings.indexOf(service) + 1 : null;
                  return (
                    <button
                      key={service.key}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => setServiceKey(service.key)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-md border px-3 py-2 text-left transition-colors",
                        active ? "border-primary bg-accent" : "border-border hover:bg-muted",
                      )}
                    >
                      <span
                        className={cn(
                          "flex size-4 shrink-0 items-center justify-center rounded-full border",
                          active ? "border-primary bg-primary text-primary-foreground" : "border-input",
                        )}
                      >
                        {active && <Check className="size-3" />}
                      </span>
                      <span className="min-w-0 flex-1 leading-tight">
                        <span className="block text-xs font-bold uppercase">{service.name}</span>
                        <span className="block text-xs text-muted-foreground">
                          {[service.description, variant ? `тариф ${variant}` : null]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                      </span>
                      <span className="shrink-0 text-right leading-tight">
                        {service.price ? (
                          <>
                            <span className="block text-sm font-medium whitespace-nowrap tabular-nums">
                              {formatUzs(service.price.total)}
                            </span>
                            {service.price.base !== null && (
                              <span className="block text-[11px] text-muted-foreground whitespace-nowrap">
                                {service.price.perKg
                                  ? `${formatNumber(service.price.base)} + ${formatNumber(service.price.perKg)}/кг`
                                  : "фиксированная цена"}
                              </span>
                            )}
                          </>
                        ) : (
                          <span className="text-xs text-muted-foreground">тариф не задан</span>
                        )}
                      </span>
                    </button>
                  );
                })}
                {show("serviceId") && <p className="text-xs text-destructive">Выберите услугу</p>}
                <p className="pt-1 text-[11px] leading-snug text-muted-foreground">
                  Фиксированный тариф Beeline — с этой суммой заказ уйдёт в Shipox.
                </p>
              </div>
            )}
          </Panel>

          <Panel title="Номер заказа Beeline">
            <Input
              value={referenceId}
              onChange={(event) => setReferenceId(event.target.value)}
              aria-invalid={show("referenceId") || undefined}
            />
            <p className="mt-1.5 text-xs text-muted-foreground">
              Свой номер из системы Beeline или оставьте сгенерированный. Заказ с одним номером
              создаётся только один раз.
            </p>
            {referenceId !== "" && (
              <button
                type="button"
                className="mt-1 text-xs text-primary hover:underline"
                onClick={() => setReferenceId(newReference())}
              >
                Сгенерировать новый
              </button>
            )}
          </Panel>

          <div className="space-y-3 rounded-md bg-card p-4 shadow-sm">
            <div className="space-y-1 text-sm">
              <SummaryRow label="Откуда">{pickupCity ?? "—"}</SummaryRow>
              <SummaryRow label="Кому">{recipientName.trim() || "—"}</SummaryRow>
              <SummaryRow label="Куда">{chosenCity?.name ?? "—"}</SummaryRow>
              <SummaryRow label="Услуга">{chosenService?.name ?? "—"}</SummaryRow>
              <SummaryRow label="Тариф доставки">
                {chosenService?.price ? formatUzs(chosenService.price.total) : "—"}
              </SummaryRow>
              <SummaryRow label="Доставка">
                {PAYER_LABEL[payer]} · {PAYMENT_TYPE_LABEL[paymentType]}
              </SummaryRow>
              <SummaryRow label="К оплате при получении">
                {/* Доставку за счёт получателя Shipox добавляет к наложенному платежу. */}
                {[cod ? formatUzs(cod) : null, payer === "recipient" ? "доставка" : null]
                  .filter(Boolean)
                  .join(" + ") || "нет"}
              </SummaryRow>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            {touched && !ready && (
              <p className="text-xs text-destructive">Заполните отмеченные поля.</p>
            )}
            <Button type="submit" className="h-10 w-full uppercase" disabled={busy}>
              <PackagePlus className="size-4" />
              {busy ? "Создаю…" : "Создать заказ"}
            </Button>
          </div>
        </div>
      </div>
    </form>
  );
}

function Panel({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-md bg-card p-4 shadow-sm">
      <div className="mb-3 flex min-h-7 items-center justify-between gap-2">
        <h2 className="text-sm font-medium">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function Field({
  label,
  invalid,
  hint,
  children,
}: {
  label: string;
  invalid?: boolean;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className={cn(invalid && "text-destructive")}>{label}</Label>
      {children}
      {invalid && hint && <p className="text-xs text-destructive">{hint}</p>}
    </div>
  );
}

function SummaryRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="truncate text-right font-medium">{children}</span>
    </div>
  );
}
