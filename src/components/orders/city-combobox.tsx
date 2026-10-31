"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, MapPin } from "lucide-react";
import type { CityOption } from "@/lib/backend/types";
import { cn } from "@/lib/utils";

/**
 * Город получателя с поиском по вводу.
 *
 * В справочнике Shipox две сотни городов — обычный список пришлось бы
 * листать. Оператор набирает первые буквы и выбирает стрелками или мышью.
 */
export function CityCombobox({
  cities,
  value,
  onChange,
  invalid,
}: {
  cities: CityOption[];
  value: string;
  onChange: (cityId: string) => void;
  invalid?: boolean;
}) {
  const selected = cities.find((city) => city.id === value) ?? null;
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement>(null);

  const matches = useMemo(() => {
    const text = query.trim().toLowerCase();
    const list = text ? cities.filter((city) => city.name.toLowerCase().includes(text)) : cities;
    return list.slice(0, 50);
  }, [cities, query]);

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const choose = (city: CityOption) => {
    onChange(city.id);
    setQuery("");
    setOpen(false);
  };

  return (
    <div ref={root} className="relative">
      <div
        className={cn(
          "flex h-9 items-center gap-2 rounded-md border bg-transparent px-2.5 text-sm focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50",
          invalid ? "border-destructive" : "border-input",
        )}
      >
        <MapPin className="size-4 shrink-0 text-muted-foreground" />
        <input
          value={open ? query : (selected?.name ?? "")}
          onChange={(event) => {
            setQuery(event.target.value);
            setActive(0);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setOpen(true);
              setActive((index) => Math.min(index + 1, matches.length - 1));
            } else if (event.key === "ArrowUp") {
              event.preventDefault();
              setActive((index) => Math.max(index - 1, 0));
            } else if (event.key === "Enter" && open && matches[active]) {
              event.preventDefault();
              choose(matches[active]);
            } else if (event.key === "Escape") {
              setOpen(false);
            }
          }}
          placeholder={selected ? selected.name : "Начните вводить: Tashkent, Buxoro…"}
          className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted-foreground"
          role="combobox"
          aria-expanded={open}
          aria-controls="city-options"
        />
        <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
      </div>

      {open && (
        <ul
          id="city-options"
          role="listbox"
          className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-md border border-border bg-popover py-1 text-sm shadow-md"
        >
          {matches.length === 0 ? (
            <li className="px-3 py-2 text-muted-foreground">Город не найден</li>
          ) : (
            matches.map((city, index) => (
              <li
                key={city.id}
                role="option"
                aria-selected={city.id === value}
                onMouseDown={(event) => {
                  event.preventDefault();
                  choose(city);
                }}
                onMouseEnter={() => setActive(index)}
                className={cn(
                  "cursor-pointer px-3 py-1.5",
                  index === active && "bg-accent",
                  city.id === value && "font-medium text-primary",
                )}
              >
                {city.name}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
