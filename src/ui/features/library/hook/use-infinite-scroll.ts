import { useCallback, useRef, useState } from 'react';

const PAGE_SIZE = 20;
const ROOT_MARGIN = '200px';

export function useInfiniteScroll(totalCount: number) {
  const [state, setState] = useState({ visibleCount: PAGE_SIZE, totalSnapshot: totalCount });
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  // Reset visible count when totalCount changes (React recommended pattern)
  let { visibleCount } = state;
  if (state.totalSnapshot !== totalCount) {
    visibleCount = PAGE_SIZE;
    setState({ visibleCount: PAGE_SIZE, totalSnapshot: totalCount });
  }

  const setSentinel = useCallback(
    (node: HTMLDivElement | null) => {
      if (observerRef.current) observerRef.current.disconnect();
      if (!node) return;
      sentinelRef.current = node;
      observerRef.current = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            setState((prev) => ({
              ...prev,
              visibleCount: Math.min(prev.visibleCount + PAGE_SIZE, totalCount),
            }));
          }
        },
        { rootMargin: ROOT_MARGIN },
      );
      observerRef.current.observe(node);
    },
    [totalCount],
  );

  return { visibleCount, setSentinel };
}
