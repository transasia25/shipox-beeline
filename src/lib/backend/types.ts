/** Ответы бэкенда кабинета. Формы повторяют `backend/src` один в один. */

export type UserRole = "ADMIN" | "SUPERVISOR" | "OPERATOR";

export type CancelReason =
  | "CUSTOMER_REQUEST"
  | "DUPLICATE"
  | "WRONG_ADDRESS"
  | "OUT_OF_STOCK"
  | "NO_CONTACT"
  | "OTHER";

export type CancelResult = "PENDING" | "SUCCESS" | "FAILED";

export interface Session {
  id: string;
  login: string;
  name: string;
  role: UserRole;
}

export interface User {
  id: string;
  login: string;
  name: string;
  role: UserRole;
  active: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  _count: { cancellations: number };
}

export interface Party {
  name: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
}

export interface Order {
  id: string;
  orderNumber: string;
  referenceId: string | null;
  status: string;
  createdAt: string | null;
  statusChangedAt: string | null;
  sender: Party | null;
  recipient: Party | null;
  codAmount: number | null;
  /** Стоимость доставки, которую насчитал Shipox. */
  deliveryCost: number | null;
  parcelValue: number | null;
  pieceCount: number | null;
  weight: number | null;
  service: string | null;
  note: string | null;
  cancellable: boolean;
}

/** Вкладки списка заказов — те же ключи, что у бэкенда (ORDER_TABS). */
export type OrderTab = "active" | "delivered" | "returns" | "cancelled";

export type OrderCounts = Record<"all" | OrderTab, number | null>;

export interface OrdersPage {
  items: Order[];
  page: number;
  size: number;
  total: number | null;
  hasMore: boolean;
}

export interface HistoryItem {
  status: string;
  note: string | null;
  date: string | null;
}

export interface Cancellation {
  id: string;
  shipoxOrderId: string;
  orderNumber: string;
  referenceId: string | null;
  recipientName: string | null;
  recipientPhone: string | null;
  statusBefore: string;
  reason: CancelReason;
  comment: string | null;
  result: CancelResult;
  errorMessage: string | null;
  createdAt: string;
  completedAt: string | null;
  user: { id: string; name: string; login: string };
}

export interface OrderDetail {
  order: Order;
  /** `null` — Shipox историю не отдал. */
  history: HistoryItem[] | null;
  cancellation: Cancellation | null;
  /** Кто создал заказ через кабинет; `null` — заказ заведён не здесь. */
  creation: Creation | null;
}

// ─────────────────────────── Создание заказа ───────────────────────────

export interface CityOption {
  id: string;
  name: string;
  lat: number;
  lon: number;
}

/** Вариант доставки: услуга с одним из её правил цены. */
export interface ServiceOption {
  /** Уникален в списке: услуга + правило. */
  key: string;
  /** Тип услуги Shipox — у вариантов одной услуги одинаковый. */
  id: string;
  /** Правило цены; `null` — Shipox тариф не отдал. */
  ruleId: string | null;
  name: string;
  description: string | null;
  priceId: string;
  courierType: string | null;
  /**
   * Тариф Shipox по правилу цены. Дополнительные сборы клиента, если они
   * настроены в Shipox, сюда не входят. `null` — Shipox тариф не отдал.
   */
  price: {
    total: number;
    base: number | null;
    perKg: number | null;
    chargeableWeight: number | null;
    currency: string;
  } | null;
}

/** Отправитель по умолчанию — склад Beeline. */
export interface Sender {
  name: string;
  phone: string;
  street: string;
  cityId: string;
  city: string;
}

export interface CreateOrderBody {
  recipientName: string;
  recipientPhone: string;
  cityId: string;
  street: string;
  apartment?: string;
  landmark?: string;
  serviceId: string;
  weight: number;
  length?: number;
  width?: number;
  height?: number;
  pieceCount?: number;
  codAmount?: number;
  parcelValue?: number;
  paymentType?: PaymentType;
  payer?: Payer;
  recipientNotAvailable?: RecipientNotAvailable;
  /** Правило цены выбранного варианта. */
  ruleId?: string;
  /** Откуда забрать. Не заданы — склад Beeline. */
  senderCityId?: string;
  senderStreet?: string;
  senderName?: string;
  senderPhone?: string;
  note?: string;
  fragile?: boolean;
  referenceId: string;
}

/** Платёжная информация заказа — значения Shipox как есть. */
export type PaymentType = "credit_balance" | "cash";
export type Payer = "sender" | "recipient";
export type RecipientNotAvailable = "do_not_deliver" | "leave_at_door" | "leave_with_concierge";

export interface CreateOrderResult {
  order: Order;
  /** `false` — заказ с этим номером уже был, второй не заводился. */
  created: boolean;
}

export type CreateResult = "PENDING" | "SUCCESS" | "FAILED";

export interface Creation {
  id: string;
  referenceId: string;
  shipoxOrderId: string | null;
  orderNumber: string | null;
  recipientName: string;
  recipientPhone: string;
  city: string;
  /** «Город, улица» точки забора; у старых записей пусто. */
  fromAddress: string | null;
  service: string;
  codAmount: string | null;
  result: CreateResult;
  errorMessage: string | null;
  createdAt: string;
  completedAt: string | null;
  user: { id: string; name: string; login: string };
}

export interface CreationsPage {
  items: Creation[];
  total: number;
  page: number;
  size: number;
}

export interface CreationsSummary {
  total: number;
  pending: number;
  byUser: CancellationsSummary["byUser"];
}

export interface CancellationsPage {
  items: Cancellation[];
  total: number;
  page: number;
  size: number;
}

export interface CancellationsSummary {
  total: number;
  pending: number;
  byUser: {
    userId: string;
    count: number;
    user: { id: string; name: string; login: string; role: UserRole; active: boolean } | null;
  }[];
  byReason: { reason: CancelReason; count: number }[];
}
