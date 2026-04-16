"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Tracks the rendered pixel width of an element via ResizeObserver.
 * Returns a [ref, width] tuple. Attach `ref` to the element you want to measure.
 * `width` is null until the first measurement fires.
 *
 * Pass `deps` (additional useEffect dependencies) to re-attach the observer
 * when DOM subtree changes cause the ref target to remount.
 */
export function useElementWidth<T extends HTMLElement>(
  deps: unknown[] = []
): [React.RefObject<T | null>, number | null] {
  const ref = useRef<T | null>(null);
  const [width, setWidth] = useState<number | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) {
      return;
    }

    setWidth(el.getBoundingClientRect().width);

    if (typeof ResizeObserver === "undefined") {
      return;
    }

    const observer = new ResizeObserver(() => {
      setWidth(el.getBoundingClientRect().width);
    });

    observer.observe(el);

    return () => {
      observer.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ref, ...deps]);

  return [ref, width];
}
