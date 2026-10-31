"use client";

import { useEffect, useState } from "react";

/**
 * Значение, которое меняется только после паузы во вводе. Нужно там, где
 * каждое изменение — запрос в Shipox: вес «1,25» не должен дать четыре запроса.
 */
export function useDebounced<T>(value: T, delayMs = 400): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}
