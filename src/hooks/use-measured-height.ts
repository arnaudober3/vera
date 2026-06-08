import { useCallback, useRef, useState } from "react";

// Tracks an element's height via ResizeObserver. Returns a callback ref to
// attach to the element and its latest measured height (0 until first measure).
// Used to overlay a floating footer while reserving exactly its height as
// bottom padding on the scroll content.
export function useMeasuredHeight(): [(el: HTMLElement | null) => void, number] {
  const [height, setHeight] = useState(0);
  const roRef = useRef<ResizeObserver | null>(null);

  const ref = useCallback((el: HTMLElement | null) => {
    roRef.current?.disconnect();
    roRef.current = null;
    if (!el) return;
    const measure = (): void => setHeight(el.getBoundingClientRect().height);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    roRef.current = ro;
  }, []);

  return [ref, height];
}
