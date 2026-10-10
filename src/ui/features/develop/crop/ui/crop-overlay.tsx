import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useShortcut } from '@shared/lib/shortcuts';
import type { CropRect, CropState } from '../store/types';
import { constrainCrop, cropBounds } from '../lib/constrain-crop';
import { dragRect, type DragHandle as Handle } from '../lib/drag-rect';
type DragHandle = Handle | null;

interface DragState {
  handle: DragHandle;
  startMouse: { x: number; y: number };
  startRect: CropRect;
}

export interface CropOverlayProps {
  canvasWidth: number;
  canvasHeight: number;
  cropState: CropState;
  zoom: number;
  imageAspect: number;
  onChange: (patch: Partial<CropState>) => void;
  style?: React.CSSProperties;
}

const HANDLE_HIT_PX = 10;
const CORNER_LEN_PX = 14;
const CORNER_THICK = 2.5;

const HANDLE_CURSORS: Record<NonNullable<DragHandle>, string> = {
  nw: 'nw-resize',
  n: 'n-resize',
  ne: 'ne-resize',
  e: 'e-resize',
  se: 'se-resize',
  s: 's-resize',
  sw: 'sw-resize',
  w: 'w-resize',
  move: 'move',
};

export function CropOverlay({
  canvasWidth,
  canvasHeight,
  cropState,
  zoom,
  imageAspect,
  onChange,
  style,
}: CropOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const [cursor, setCursor] = useState('crosshair');
  // Live rect while dragging; committed once on mouse-up so history/auto-save
  // don't snapshot mid-drag (one history step per drag, like Lightroom).
  const [draftRect, setDraftRect] = useState<CropRect | null>(null);
  const draftRef = useRef<CropRect | null>(null);
  const rafRef = useRef<number | null>(null);
  const rect = draftRect ?? cropState.rect;

  // The canvas shows the straightened image's bounding box, not just the original frame.
  const bounds = useMemo(() => cropBounds(cropState, imageAspect), [cropState, imageAspect]);

  // ── Coordinate helpers ──────────────────────────────────────────────────
  const toCanvas = useCallback(
    (nx: number, ny: number) => ({
      x: ((nx - bounds.x) / bounds.w) * canvasWidth,
      y: ((ny - bounds.y) / bounds.h) * canvasHeight,
    }),
    [bounds, canvasWidth, canvasHeight],
  );
  const toNorm = useCallback(
    (cx: number, cy: number) => ({
      x: bounds.x + (cx / canvasWidth) * bounds.w,
      y: bounds.y + (cy / canvasHeight) * bounds.h,
    }),
    [bounds, canvasWidth, canvasHeight],
  );

  // ── Draw ────────────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.setTransform(zoom, 0, 0, zoom, 0, 0);
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);

    const tl = toCanvas(rect.x, rect.y);
    const br = toCanvas(rect.x + rect.w, rect.y + rect.h);
    const rw = br.x - tl.x;
    const rh = br.y - tl.y;

    const invZ = 1 / zoom;

    // Darken outside crop
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.beginPath();
    ctx.rect(0, 0, canvasWidth, canvasHeight);
    ctx.rect(tl.x, tl.y, rw, rh); // counter-clockwise hole
    ctx.fill('evenodd');

    // Rule-of-thirds grid (inside crop)
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = invZ;
    for (let i = 1; i <= 2; i++) {
      const x = tl.x + rw * (i / 3);
      const y = tl.y + rh * (i / 3);
      ctx.beginPath();
      ctx.moveTo(x, tl.y);
      ctx.lineTo(x, br.y);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(tl.x, y);
      ctx.lineTo(br.x, y);
      ctx.stroke();
    }

    // Crop border
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = invZ;
    ctx.strokeRect(tl.x, tl.y, rw, rh);

    // Corner handles (L-shaped, Lightroom style)
    const cl = CORNER_LEN_PX * invZ;
    const ct = CORNER_THICK * invZ;
    ctx.fillStyle = '#ffffff';
    const corners: [number, number, number, number][] = [
      [tl.x, tl.y, 1, 1],
      [br.x, tl.y, -1, 1],
      [br.x, br.y, -1, -1],
      [tl.x, br.y, 1, -1],
    ];
    for (const [cx, cy, sx, sy] of corners) {
      ctx.fillRect(cx - ct * (sx < 0 ? 1 : 0), cy - ct * (sy < 0 ? 1 : 0), cl * sx, ct * sy); // horizontal arm
      ctx.fillRect(cx - ct * (sx < 0 ? 1 : 0), cy - ct * (sy < 0 ? 1 : 0), ct * sx, cl * sy); // vertical arm
    }

    // Edge midpoint handles (small squares)
    const hs = 4 * invZ;
    const mids: [number, number][] = [
      [tl.x + rw / 2, tl.y],
      [br.x, tl.y + rh / 2],
      [tl.x + rw / 2, br.y],
      [tl.x, tl.y + rh / 2],
    ];
    for (const [mx, my] of mids) {
      ctx.fillRect(mx - hs, my - hs, hs * 2, hs * 2);
    }
  }, [rect, zoom, canvasWidth, canvasHeight, toCanvas]);

  // ── Hit detection ───────────────────────────────────────────────────────
  const findHandle = useCallback(
    (cx: number, cy: number): DragHandle => {
      const tl = toCanvas(rect.x, rect.y);
      const br = toCanvas(rect.x + rect.w, rect.y + rect.h);
      const mid = { x: (tl.x + br.x) / 2, y: (tl.y + br.y) / 2 };
      const hit = HANDLE_HIT_PX / zoom;

      const near = (ax: number, ay: number) => Math.abs(cx - ax) <= hit && Math.abs(cy - ay) <= hit;

      if (near(tl.x, tl.y)) return 'nw';
      if (near(mid.x, tl.y)) return 'n';
      if (near(br.x, tl.y)) return 'ne';
      if (near(br.x, mid.y)) return 'e';
      if (near(br.x, br.y)) return 'se';
      if (near(mid.x, br.y)) return 's';
      if (near(tl.x, br.y)) return 'sw';
      if (near(tl.x, mid.y)) return 'w';
      if (cx >= tl.x && cx <= br.x && cy >= tl.y && cy <= br.y) return 'move';
      return null;
    },
    [rect, toCanvas, zoom],
  );

  // ── Pos helper ──────────────────────────────────────────────────────────
  const getPos = (e: React.MouseEvent | MouseEvent) => {
    const box = canvasRef.current!.getBoundingClientRect();
    const sx = canvasWidth / box.width;
    const sy = canvasHeight / box.height;
    return { x: (e.clientX - box.left) * sx, y: (e.clientY - box.top) * sy };
  };

  // ── Clamp rect inside the work area ─────────────────────────────────────
  const clampRect = (r: CropRect): CropRect => {
    const b = bounds;
    const minW = (20 / canvasWidth) * b.w;
    const minH = (20 / canvasHeight) * b.h;
    const right = b.x + b.w;
    const bottom = b.y + b.h;
    const x = Math.max(b.x, Math.min(right - Math.max(r.w, minW), r.x));
    const y = Math.max(b.y, Math.min(bottom - Math.max(r.h, minH), r.y));
    const w = Math.max(minW, Math.min(right - x, r.w));
    const h = Math.max(minH, Math.min(bottom - y, r.h));
    return { x, y, w, h };
  };

  // ── Mouse down ──────────────────────────────────────────────────────────
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.button !== 0) return;
    const pos = getPos(e);
    const handle = findHandle(pos.x, pos.y);
    const normPos = toNorm(pos.x, pos.y);
    dragRef.current = {
      handle,
      startMouse: normPos,
      startRect: { ...rect },
    };
  };

  // ── Window-level mouse move/up ──────────────────────────────────────────
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const drag = dragRef.current;
      if (!drag || !drag.handle) return;
      const pos = getPos(e as unknown as React.MouseEvent);
      const norm = toNorm(pos.x, pos.y);
      const dx = norm.x - drag.startMouse.x;
      const dy = norm.y - drag.startMouse.y;
      const sr = drag.startRect;
      const r = dragRect(drag.handle, sr, dx, dy, cropState.lockAspect);
      const base = draftRef.current ?? sr;
      draftRef.current = constrainCrop(
        { ...cropState, rect: base },
        { ...cropState, rect: clampRect(r) },
        imageAspect,
      ).rect;
      // High-rate mice fire several moves per frame — repaint once per frame.
      if (rafRef.current === null) {
        rafRef.current = requestAnimationFrame(() => {
          rafRef.current = null;
          setDraftRect(draftRef.current);
        });
      }
    };

    const onUp = () => {
      dragRef.current = null;
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      const committed = draftRef.current;
      draftRef.current = null;
      setDraftRect(null);
      if (committed) onChange({ rect: committed });
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cropState, toNorm, imageAspect, onChange, canvasWidth, canvasHeight]);

  // ── Cursor update ───────────────────────────────────────────────────────
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const pos = getPos(e);
    const handle = findHandle(pos.x, pos.y);
    setCursor(handle ? HANDLE_CURSORS[handle] : 'crosshair');
  };

  const handleCropReset = useCallback(
    () => onChange({ rect: { x: 0, y: 0, w: 1, h: 1 } }),
    [onChange],
  );

  useShortcut([{ id: 'crop.reset', handler: handleCropReset }]);

  if (canvasWidth === 0 || canvasHeight === 0) return null;

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0"
      width={Math.round(canvasWidth * zoom)}
      height={Math.round(canvasHeight * zoom)}
      style={{ width: canvasWidth, height: canvasHeight, cursor, touchAction: 'none', ...style }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
    />
  );
}
