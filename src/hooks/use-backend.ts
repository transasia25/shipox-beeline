"use client";

import { useCallback, useEffect, useState } from "react";
import { ApiError } from "@/lib/backend/client";

interface Loaded<T> {
  /** Ключ запроса, которому соответствуют данные. */
  key: string;
  data: T | null;
  error: string | null;
}

/**
 * Загрузка данных из бэкенда.
 *
 * Ошибка не глотается: если API недоступен или ответил отказом, экран
 * показывает причину, а не пустую таблицу — иначе «заказов нет» и «Shipox не
 * отвечает» выглядели бы одинаково.
 *
 * Пока идёт перезапрос, `data` держит прошлый ответ: таблица не мигает
 * скелетом на каждый символ в поиске и после отмены заказа.
 */
export function useBackend<T>(load: () => Promise<T>, deps: unknown[]) {
  const [reloadToken, setReloadToken] = useState(0);
  const key = `${JSON.stringify(deps)}#${reloadToken}`;
  const [loaded, setLoaded] = useState<Loaded<T>>({ key: "", data: null, error: null });

  useEffect(() => {
    let cancelled = false;

    load()
      .then((data) => {
        if (!cancelled) setLoaded({ key, data, error: null });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        const message =
          error instanceof ApiError
            ? error.message
            : ((error as Error)?.message ?? "Неизвестная ошибка");
        setLoaded({ key, data: null, error: message });
      });

    return () => {
      cancelled = true;
    };
    // `load` — новая функция на каждый рендер, поэтому в зависимости не идёт:
    // перезапрос определяется явным списком deps и кнопкой «повторить».
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const reload = useCallback(() => setReloadToken((value) => value + 1), []);

  return {
    data: loaded.data,
    error: loaded.key === key ? loaded.error : null,
    loading: loaded.key !== key,
    reload,
  };
}
