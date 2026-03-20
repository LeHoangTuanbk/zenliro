import { useCallback, useEffect, useRef, useState } from 'react';

const PAGE_SIZE = 20;
const ROOT_MARGIN = '200px';

export function useInfiniteScroll(totalCount: number) {
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [totalCount]);

  const observerRef = useRef<IntersectionObserver | null>(null);

  const setSentinel = useCallback(
    (node: HTMLDivElement | null) => {
      if (observerRef.current) observerRef.current.disconnect();
      if (!node) return;
      sentinelRef.current = node;
      observerRef.current = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            setVisibleCount((prev) => Math.min(prev + PAGE_SIZE, totalCount));
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
