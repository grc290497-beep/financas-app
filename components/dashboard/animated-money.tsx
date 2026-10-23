"use client";

import { useEffect, useRef, useState } from "react";
import { formatMoney } from "@/lib/money";
import type { Currency } from "@/lib/validators";

// Last value shown per figure, so the next render counts from it (a new month,
// a saved entry). The first load shows the value as is: no flash from zero.
const shown = new Map<string, number>();
const DURATION = 650;
const easeOut = (t: number) => 1 - (1 - t) ** 3;

/** A money figure that counts to its new value when it changes. */
export function AnimatedMoney({
  id,
  cents,
  currency,
}: {
  /** Which figure this is ("available", "leftover"), to remember its last value. */
  id: string;
  cents: number;
  currency: Currency;
}) {
  const [value, setValue] = useState(() => shown.get(id) ?? cents);
  // What is on screen right now, so a change mid-count continues from there.
  const current = useRef(value);
  const frame = useRef(0);

  useEffect(() => {
    shown.set(id, cents);
    const from = current.current;
    if (from === cents) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const start = performance.now();
    const tick = (now: number) => {
      const t = reduce ? 1 : Math.min((now - start) / DURATION, 1);
      current.current = Math.round(from + (cents - from) * easeOut(t));
      setValue(current.current);
      if (t < 1) frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame.current);
  }, [id, cents]);
  return <>{formatMoney(value, currency)}</>;
}
