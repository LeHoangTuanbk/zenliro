import { useEffect, useRef, useState } from 'react';
import type React from 'react';

// Drag-and-drop state for the conversation panel header. Tracks the panel's
// absolute position in px (null = use default anchored layout), and clamps the
// position inside the viewport on window resize.
export function useConversationDrag(panelRef: React.RefObject<HTMLDivElement>, disabled: boolean) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const dragState = useRef<{ offsetX: number; offsetY: number } | null>(null);

  useEffect(() => {
    if (!pos) return;
    const clamp = () => {
      const el = panelRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const maxX = Math.max(0, window.innerWidth - r.width);
      const maxY = Math.max(0, window.innerHeight - r.height);
      setPos((p) =>
        p ? { x: Math.min(Math.max(0, p.x), maxX), y: Math.min(Math.max(0, p.y), maxY) } : p,
      );
    };
    window.addEventListener('resize', clamp);
    return () => window.removeEventListener('resize', clamp);
  }, [pos, panelRef]);

  const startDrag = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    if (disabled) return;
    const el = panelRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    dragState.current = { offsetX: e.clientX - r.left, offsetY: e.clientY - r.top };
    if (!pos) setPos({ x: r.left, y: r.top });

    const onMove = (ev: MouseEvent) => {
      const d = dragState.current;
      if (!d) return;
      const w = el.offsetWidth;
      const h = el.offsetHeight;
      const nx = Math.min(Math.max(0, ev.clientX - d.offsetX), window.innerWidth - w);
      const ny = Math.min(Math.max(0, ev.clientY - d.offsetY), window.innerHeight - h);
      setPos({ x: nx, y: ny });
    };
    const onUp = () => {
      dragState.current = null;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    e.preventDefault();
  };

  const resetPos = () => setPos(null);

  return { pos, startDrag, resetPos };
}
