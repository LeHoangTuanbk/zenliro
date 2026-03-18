import { useCallback, useEffect, useRef, useState } from 'react';
import type { HealMode, HealSpot } from '../store/types';

interface DragState {
  type: 'idle' | 'dragging-dst' | 'dragging-src';
  spotId?: string;
}

export interface HealOverlayProps {
  canvasWidth: number;
  canvasHeight: number;
  spots: HealSpot[];
  selectedSpotId: string | null;
  brushSizePx: number; // brush radius in screen pixels
  zoom: number;
  activeMode: HealMode;
  onAddSpot: (normX: number, normY: number) => void;
  onMoveSpotDst: (id: string, normX: number, normY: number) => void;
  onMoveSpotSrc: (id: string, normX: number, normY: number) => void;
  onSelectSpot: (id: string | null) => void;
  onDeleteSpot: (id: string) => void;
  onBrushSizeChange: (px: number) => void;
  style?: React.CSSProperties;
}

const HIT_R_PX = 10; // px tolerance for clicking on a circle

export function HealOverlay({
  canvasWidth,
  canvasHeight,
  spots,
  selectedSpotId,
  brushSizePx,
  zoom,
  onAddSpot,
  onMoveSpotDst,
  onMoveSpotSrc,
  onSelectSpot,
  onDeleteSpot,
  onBrushSizeChange,
  style,
}: HealOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);
  const dragRef = useRef<DragState>({ type: 'idle' });
  const isDraggingRef = useRef(false);

  // Canvas → normalized
  const toNorm = useCallback(
    (cx: number, cy: number) => ({ x: cx / canvasWidth, y: cy / canvasHeight }),
    [canvasWidth, canvasHeight],
  );

  // Normalized → canvas
  const toCanvas = useCallback(
    (nx: number, ny: number) => ({ x: nx * canvasWidth, y: ny * canvasHeight }),
    [canvasWidth, canvasHeight],
  );

  // ── Draw ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Scale context so drawing coords stay in [0, canvasWidth] × [0, canvasHeight].
    // Combined with the high-res intrinsic size (canvasWidth*zoom), this gives
    // crisp rendering at any zoom level — no bilinear blur.
    ctx.setTransform(zoom, 0, 0, zoom, 0, 0);
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);

    // invZ keeps strokes/dots at constant screen size regardless of zoom.
    const invZ = 1 / zoom;
    // brushSizePx is in screen pixels. ÷zoom converts to CSS px in the overlay
    // (parent CSS transform scale(zoom) will bring it back to brushSizePx screen px).
    const dispR = brushSizePx / zoom;
    // Drop shadow makes circles visible on any background
    const shadowBlur = 3 * invZ;
    ctx.shadowColor = 'rgba(0,0,0,0.7)';
    ctx.shadowBlur = shadowBlur;
    const dotR = 2.5 * invZ;
    const cursorDotR = 2 * invZ;

    for (const spot of spots) {
      const dst = toCanvas(spot.dst.x, spot.dst.y);
      const src = toCanvas(spot.src.x, spot.src.y);
      const r = spot.radius * canvasWidth;
      const isSelected = spot.id === selectedSpotId;
      const col = isSelected ? '#4d9fec' : '#ffffff';
      const lw = (isSelected ? 2 : 1.5) * invZ;

      const isFill = spot.mode === 'fill';

      // Connecting line + src circle (not shown for fill mode)
      if (!isFill) {
        ctx.beginPath();
        ctx.moveTo(dst.x, dst.y);
        ctx.lineTo(src.x, src.y);
        ctx.strokeStyle = isSelected ? 'rgba(77,159,236,0.9)' : 'rgba(255,255,255,0.7)';
        ctx.lineWidth = invZ;
        ctx.setLineDash([4 * invZ, 3 * invZ]);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Dst circle (solid)
      ctx.beginPath();
      ctx.arc(dst.x, dst.y, r, 0, Math.PI * 2);
      ctx.strokeStyle = col;
      ctx.lineWidth = lw;
      ctx.stroke();

      // Dst center dot
      ctx.beginPath();
      ctx.arc(dst.x, dst.y, dotR, 0, Math.PI * 2);
      ctx.fillStyle = col;
      ctx.fill();

      if (!isFill) {
        // Src circle (dashed)
        ctx.beginPath();
        ctx.arc(src.x, src.y, r, 0, Math.PI * 2);
        ctx.strokeStyle = col;
        ctx.lineWidth = lw;
        ctx.setLineDash([4 * invZ, 3 * invZ]);
        ctx.stroke();
        ctx.setLineDash([]);

        // Arrow on src circle pointing toward dst
        const angle = Math.atan2(dst.y - src.y, dst.x - src.x);
        const ax = src.x + Math.cos(angle) * r;
        const ay = src.y + Math.sin(angle) * r;
        const al = Math.max(6 * invZ, r * 0.35);
        ctx.beginPath();
        ctx.moveTo(ax - Math.cos(angle - 0.45) * al, ay - Math.sin(angle - 0.45) * al);
        ctx.lineTo(ax, ay);
        ctx.lineTo(ax - Math.cos(angle + 0.45) * al, ay - Math.sin(angle + 0.45) * al);
        ctx.strokeStyle = col;
        ctx.lineWidth = lw;
        ctx.stroke();
      }
    }

    // Cursor brush ring
    if (mousePos && dragRef.current.type === 'idle') {
      ctx.beginPath();
      ctx.arc(mousePos.x, mousePos.y, dispR, 0, Math.PI * 2);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = invZ;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(mousePos.x, mousePos.y, cursorDotR, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
    }
  }, [spots, selectedSpotId, mousePos, brushSizePx, zoom, canvasWidth, canvasHeight, toCanvas]);

  // ── Hit detection ─────────────────────────────────────────────────────────
  const findHit = useCallback(
    (cx: number, cy: number) => {
      for (let i = spots.length - 1; i >= 0; i--) {
        const spot = spots[i];
        const dst = toCanvas(spot.dst.x, spot.dst.y);
        const src = toCanvas(spot.src.x, spot.src.y);
        const r = spot.radius * canvasWidth;

        const distDst = Math.sqrt((cx - dst.x) ** 2 + (cy - dst.y) ** 2);
        const distSrc = Math.sqrt((cx - src.x) ** 2 + (cy - src.y) ** 2);

        if (distDst <= r + HIT_R_PX) return { spot, part: 'dst' as const };
        if (distSrc <= r + HIT_R_PX) return { spot, part: 'src' as const };
      }
      return null;
    },
    [spots, toCanvas, canvasWidth],
  );

  // ── Canvas position helper ────────────────────────────────────────────────
  const getPos = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const scaleX = canvasWidth / rect.width;
    const scaleY = canvasHeight / rect.height;
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
  };

  // ── Mouse handlers ────────────────────────────────────────────────────────
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.button !== 0) return;
    const pos = getPos(e);
    const hit = findHit(pos.x, pos.y);

    if (hit) {
      onSelectSpot(hit.spot.id);
      dragRef.current = {
        type: hit.part === 'dst' ? 'dragging-dst' : 'dragging-src',
        spotId: hit.spot.id,
      };
      isDraggingRef.current = false;
    } else {
      onSelectSpot(null);
      isDraggingRef.current = false;
      dragRef.current = { type: 'idle' };
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const pos = getPos(e);
    setMousePos(pos);

    const drag = dragRef.current;
    if (drag.type === 'dragging-dst' && drag.spotId) {
      isDraggingRef.current = true;
      const norm = toNorm(pos.x, pos.y);
      onMoveSpotDst(drag.spotId, norm.x, norm.y);
    } else if (drag.type === 'dragging-src' && drag.spotId) {
      isDraggingRef.current = true;
      const norm = toNorm(pos.x, pos.y);
      onMoveSpotSrc(drag.spotId, norm.x, norm.y);
    }
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const wasDragging = isDraggingRef.current;
    isDraggingRef.current = false;

    // If we clicked (not dragged) on empty canvas → add spot
    if (!wasDragging && dragRef.current.type === 'idle') {
      const pos = getPos(e);
      const hit = findHit(pos.x, pos.y);
      if (!hit) {
        const norm = toNorm(pos.x, pos.y);
        onAddSpot(norm.x, norm.y);
      }
    }

    dragRef.current = { type: 'idle' };
  };

  const handleMouseLeave = () => {
    setMousePos(null);
    dragRef.current = { type: 'idle' };
    isDraggingRef.current = false;
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    // Let Cmd/Ctrl+scroll pass through to the parent zoom handler
    if (e.metaKey || e.ctrlKey) return;
    e.preventDefault();
    const delta = e.deltaY > 0 ? -3 : 3;
    onBrushSizeChange(Math.max(5, Math.min(200, brushSizePx + delta)));
  };

  // Delete key
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedSpotId) {
        onDeleteSpot(selectedSpotId);
      }
    },
    [selectedSpotId, onDeleteSpot],
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  if (canvasWidth === 0 || canvasHeight === 0) return null;

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0"
      width={Math.round(canvasWidth * zoom)}
      height={Math.round(canvasHeight * zoom)}
      style={{
        cursor: 'none',
        touchAction: 'none',
        width: canvasWidth,
        height: canvasHeight,
        ...style,
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
      onWheel={handleWheel}
    />
  );
}
