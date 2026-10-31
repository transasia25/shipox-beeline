import type {
  CityOption,
  CreateOrderBody,
  CreateOrderResult,
  CreationsPage,
  CreationsSummary,
  Sender,
  ServiceOption,
  CancelReason,
  Cancellation,
  CancellationsPage,
  CancellationsSummary,
  OrderCounts,
  OrderDetail,
  OrderTab,
  OrdersPage,
  Session,
  User,
  UserRole,
} from "./types";

/**
 * Доступ к бэкенду.
 *
 * Единственное место во фронтенде, которое знает адреса API. Экраны работают
 * с типизированными функциями и не собирают URL руками.
 *
 * Адрес по умолчанию — свой же origin: `/api` проксируется на бэкенд (в
 * разработке — `next.config.ts`, на сервере — Caddy). Так кука сессии остаётся
 * своей для браузера, и Safari её не выбрасывает.
 */
const BASE_URL = (process.env.NEXT_PUBLIC_API_URL ?? "/api").replace(/\/+$/, "");

/** Ошибка запроса с внятным текстом: её показывают прямо на экране. */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** Параметры строки запроса. Пустые значения в URL не попадают. */
export type Params = Record<string, string | number | boolean | undefined | null>;

function buildUrl(path: string, params?: Params): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value === undefined || value === null || value === "") continue;
    search.set(key, String(value));
  }
  const query = search.toString();
  return `${BASE_URL}${path}${query ? `?${query}` : ""}`;
}

async function request<T>(path: string, init?: RequestInit & { params?: Params }): Promise<T> {
  const { params, ...rest } = init ?? {};
  let response: Response;

  try {
    response = await fetch(buildUrl(path, params), {
      ...rest,
      // Сессия живёт в куке бэкенда — без этого каждый запрос был бы гостевым.
      credentials: "include",
      headers: { "Content-Type": "application/json", ...rest.headers },
      cache: "no-store",
    });
  } catch {
    throw new ApiError("Сервер кабинета не отвечает. Проверьте связь и повторите.", 0);
  }

  if (!response.ok) {
    if (response.status === 401 && typeof window !== "undefined") {
      // Сессия кончилась. Событием, а не прямым вызовом: клиент не должен
      // зависеть от состояния сессии, иначе импорты пойдут по кругу.
      window.dispatchEvent(new CustomEvent("bpk:unauthorized"));
    }
    const body = await response.text();
    let message = `${response.status} ${response.statusText}`;
    try {
      const parsed = JSON.parse(body) as { message?: string | string[] };
      if (parsed.message) {
        message = Array.isArray(parsed.message) ? parsed.message.join("; ") : parsed.message;
      }
    } catch {
      if (body) message = body.slice(0, 300);
    }
    throw new ApiError(message, response.status);
  }

  return (await response.json()) as T;
}

// ─────────────────────────────── Заказы ───────────────────────────────

export function listOrders(query: { search?: string; tab?: OrderTab; page?: number; size?: number }) {
  return request<OrdersPage>("/orders", { params: query });
}

/** Счётчики вкладок для того же поиска. */
export function getOrderCounts(query: { search?: string }) {
  return request<OrderCounts>("/orders/counts", { params: query });
}

export function getOrder(id: string) {
  return request<OrderDetail>(`/orders/${encodeURIComponent(id)}`);
}

/** Кто отменяет — известно из сессии, в теле только причина. */
export function cancelOrder(id: string, body: { reason: CancelReason; comment?: string }) {
  return request<Cancellation>(`/orders/${encodeURIComponent(id)}/cancel`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

// ─────────────────────────── Создание заказа ───────────────────────────

export function listCities(search?: string) {
  return request<CityOption[]>("/orders/cities", { params: { search } });
}

/** Услуги на маршруте: из города забора (по умолчанию склад Beeline) до города получателя. */
export function listServices(query: {
  cityId: string;
  fromCityId?: string;
  weight?: number;
  length?: number;
  width?: number;
  height?: number;
}) {
  return request<ServiceOption[]>("/orders/services", { params: query });
}

export function getSender() {
  return request<Sender>("/orders/sender");
}

export function createOrder(body: CreateOrderBody) {
  return request<CreateOrderResult>("/orders", { method: "POST", body: JSON.stringify(body) });
}

export function listCreations(query: CancellationsQuery) {
  return request<CreationsPage>("/creations", { params: query });
}

export function getCreationsSummary(query: CancellationsQuery) {
  return request<CreationsSummary>("/creations/summary", { params: query });
}

// ──────────────────────────── Журнал отмен ────────────────────────────

export interface CancellationsQuery extends Params {
  from?: string;
  to?: string;
  userId?: string;
  reason?: CancelReason | "";
  search?: string;
  page?: number;
  size?: number;
}

export function listCancellations(query: CancellationsQuery) {
  return request<CancellationsPage>("/cancellations", { params: query });
}

export function getCancellationsSummary(query: CancellationsQuery) {
  return request<CancellationsSummary>("/cancellations/summary", { params: query });
}

// ─────────────────────────── Вход и сотрудники ───────────────────────────

/** Нужна ли первичная настройка: в базе ещё нет ни одного сотрудника. */
export function getAuthState() {
  return request<{ needsSetup: boolean; setupKeyRequired: boolean }>("/auth/state");
}

export function login(body: { login: string; password: string }) {
  return request<Session>("/auth/login", { method: "POST", body: JSON.stringify(body) });
}

/** Первичная настройка: заводит администратора и сразу входит под ним. */
export function setupAdmin(body: { login: string; name: string; password: string; setupKey?: string }) {
  return request<Session>("/auth/setup", { method: "POST", body: JSON.stringify(body) });
}

export function getSession() {
  return request<Session>("/auth/me");
}

export function logout() {
  return request<{ ok: boolean }>("/auth/logout", { method: "POST", body: JSON.stringify({}) });
}

export function changeOwnPassword(body: { currentPassword: string; password: string }) {
  return request<{ ok: boolean }>("/auth/password", { method: "POST", body: JSON.stringify(body) });
}

export function listUsers() {
  return request<User[]>("/users");
}

export function createUser(body: { login: string; name: string; password: string; role: UserRole }) {
  return request<User>("/users", { method: "POST", body: JSON.stringify(body) });
}

export function updateUser(id: string, body: { name?: string; role?: UserRole; active?: boolean }) {
  return request<User>(`/users/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export function setUserPassword(id: string, password: string) {
  return request<{ ok: boolean }>(`/users/${encodeURIComponent(id)}/password`, {
    method: "POST",
    body: JSON.stringify({ password }),
  });
}
