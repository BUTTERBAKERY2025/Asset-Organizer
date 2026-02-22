import { useState, useEffect, useRef, useMemo, useCallback } from "react";

interface VirtualScrollOptions {
  itemCount: number;
  itemHeight: number;
  overscan?: number;
  containerHeight?: number;
}

interface VirtualScrollResult {
  containerRef: React.RefObject<HTMLDivElement | null>;
  virtualItems: { index: number; offsetTop: number }[];
  totalHeight: number;
  containerProps: {
    style: React.CSSProperties;
    onScroll: () => void;
    ref: React.RefObject<HTMLDivElement | null>;
  };
  innerProps: {
    style: React.CSSProperties;
  };
}

export function useVirtualScroll({
  itemCount,
  itemHeight,
  overscan = 5,
  containerHeight: fixedHeight,
}: VirtualScrollOptions): VirtualScrollResult {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [height, setHeight] = useState(fixedHeight || 600);

  useEffect(() => {
    if (fixedHeight) {
      setHeight(fixedHeight);
      return;
    }
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(entries => {
      for (const entry of entries) {
        setHeight(entry.contentRect.height);
      }
    });
    observer.observe(el);
    setHeight(el.clientHeight);
    return () => observer.disconnect();
  }, [fixedHeight]);

  const handleScroll = useCallback(() => {
    if (containerRef.current) {
      setScrollTop(containerRef.current.scrollTop);
    }
  }, []);

  const totalHeight = itemCount * itemHeight;

  const virtualItems = useMemo(() => {
    const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
    const endIndex = Math.min(
      itemCount - 1,
      Math.ceil((scrollTop + height) / itemHeight) + overscan
    );
    const items: { index: number; offsetTop: number }[] = [];
    for (let i = startIndex; i <= endIndex; i++) {
      items.push({ index: i, offsetTop: i * itemHeight });
    }
    return items;
  }, [scrollTop, height, itemCount, itemHeight, overscan]);

  return {
    containerRef,
    virtualItems,
    totalHeight,
    containerProps: {
      style: { overflow: "auto", position: "relative" as const },
      onScroll: handleScroll,
      ref: containerRef,
    },
    innerProps: {
      style: { height: totalHeight, position: "relative" as const, width: "100%" },
    },
  };
}
