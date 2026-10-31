import type {
  CancelReason,
  CancelResult,
  Payer,
  PaymentType,
  RecipientNotAvailable,
} from "@/lib/backend/types";

/**
 * Подписи статусов Shipox. Незнакомый статус показывается как есть: Shipox
 * может добавить новый, и оператор должен видеть его, а не пустое место.
 */
const ORDER_STATUS_LABEL: Record<string, string> = {
  draft: "Черновик",
  created: "Создан",
  accepted: "Принят",
  ready_for_pickup: "Готов к забору",
  unassigned: "Не назначен",
  assigned_to_courier: "Назначен курьеру",
  on_his_way: "Курьер едет за заказом",
  arrived: "Курьер на месте",
  picked_up: "Забран",
  in_sorting_facility: "На складе",
  in_transit: "В пути",
  dispatched: "Отправлен со склада",
  out_for_delivery: "У курьера на доставке",
  delivery_attempt: "Попытка доставки",
  delivery_failed: "Доставка не удалась",
  to_be_returned: "К возврату",
  out_for_return: "Везут обратно",
  returned_to_origin: "Возвращён отправителю",
  completed: "Доставлен",
  order_completed: "Доставлен",
  delivered: "Доставлен",
  issued: "Выдан в ПВЗ",
  cancelled: "Отменён",
  canceled: "Отменён",
  cancelled_due_to_out_of_delivery_area: "Отменён: вне зоны доставки",
};

export function orderStatusLabel(status: string): string {
  return ORDER_STATUS_LABEL[status.toLowerCase()] ?? status;
}

export type StatusTone = "active" | "done" | "cancelled" | "problem";

export function orderStatusTone(status: string): StatusTone {
  const value = status.toLowerCase();
  if (value.startsWith("cancel")) return "cancelled";
  if (["completed", "order_completed", "delivered", "issued"].includes(value)) return "done";
  if (["delivery_failed", "to_be_returned", "out_for_return", "returned_to_origin"].includes(value)) {
    return "problem";
  }
  return "active";
}

export const CANCEL_REASON_LABEL: Record<CancelReason, string> = {
  CUSTOMER_REQUEST: "Клиент попросил отменить",
  DUPLICATE: "Дубль заказа",
  WRONG_ADDRESS: "Неверный адрес или телефон",
  OUT_OF_STOCK: "Нет товара в наличии",
  NO_CONTACT: "Клиент не выходит на связь",
  OTHER: "Другое",
};

export const CANCEL_RESULT_LABEL: Record<CancelResult, string> = {
  PENDING: "Не подтверждена",
  SUCCESS: "Отменён",
  FAILED: "Shipox отказал",
};

/** Подписи платёжной информации — как в форме заказа старого Shipox. */
export const PAYMENT_TYPE_LABEL: Record<PaymentType, string> = {
  credit_balance: "Кредитный баланс",
  cash: "Наличные",
};

export const PAYER_LABEL: Record<Payer, string> = {
  sender: "Отправитель",
  recipient: "Получатель",
};

export const RECIPIENT_NOT_AVAILABLE_LABEL: Record<RecipientNotAvailable, string> = {
  do_not_deliver: "Не доставлять",
  leave_at_door: "Оставить у двери",
  leave_with_concierge: "Оставить у консьержа",
};
