import { useCallback, useEffect, useRef, useState } from 'react';
import { useShortcut } from '@shared/lib/shortcuts';
import type { HealMode, HealSpot, ToolOverlayMode } from '../store/types';

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
  toolOverlay: ToolOverlayMode;
  onAddSpot: (normX: number, normY: number, strokeId?: string) => void;
  onMoveSpotDst: (id: string, normX: number, normY: number) => void;
  onMoveSpotSrc: (id: string, normX: number, normY: number) => void;
  onSelectSpot: (id: string | null) => void;
  onDeleteSpot: (id: string) => void;
  onBrushSizeChange: (px: number) => void;
  style?: React.CSSProperties;
}

// Hit tolerances in SCREEN pixels. Converted to canvas space per-zoom inside
// findHit so the clickable area stays constant on screen at any zoom level.
const DOT_HIT_SCREEN_PX = 20; // around the center dot
const RING_HIT_SCREEN_PX = 10; // around the circle ring (the line renders ~2px)

export function HealOverlay({
  canvasWidth,
  canvasHeight,
  spots,
  selectedSpotId,
  brushSizePx,
  zoom,
  toolOverlay,
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

    // Tool overlay visibility: LR Classic parity
    //  - auto:      show while mouse is over canvas + always show the selected spot
    //  - always:    show all circles
    //  - selected:  only the selected spot's circle
    //  - never:     hide all circles
    const hovering = mousePos !== null;
    const showAllCircles = toolOverlay === 'always' || (toolOverlay === 'auto' && hovering);
    const showSelectedCircle = toolOverlay !== 'never';

    for (const spot of spots) {
      const isSelected = spot.id === selectedSpotId;
      if (!showAllCircles && !(isSelected && showSelectedCircle)) continue;

      const dst = toCanvas(spot.dst.x, spot.dst.y);
      const src = toCanvas(spot.src.x, spot.src.y);
      const r = spot.radius * canvasWidth;
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
  }, [
    spots,
    selectedSpotId,
    mousePos,
    brushSizePx,
    zoom,
    canvasWidth,
    canvasHeight,
    toCanvas,
    toolOverlay,
  ]);

  // ── Hit detection ─────────────────────────────────────────────────────────
  // Match Lightroom Classic: only the center dot and the ring edge are clickable;
  // the interior passes through so clicking inside an existing spot can create a new one.
  //
  // When dst and src circles overlap (close spots), we pick the candidate
  // nearest to the cursor instead of blindly preferring dst — otherwise users
  // can never grab the source. Dot hits always outrank ring hits via the score
  // offset below.
  const findHit = useCallback(
    (cx: number, cy: number) => {
      // Canvas-space tolerances, scaled so on-screen they stay constant
      // regardless of zoom (the parent applies a CSS scale(zoom)).
      const dotR = DOT_HIT_SCREEN_PX / zoom;
      const ringR = RING_HIT_SCREEN_PX / zoom;

      let best: { spot: HealSpot; part: 'dst' | 'src'; score: number } | null = null;
      const consider = (spot: HealSpot, part: 'dst' | 'src', px: number, py: number, r: number) => {
        const dist = Math.hypot(cx - px, cy - py);
        let score = Infinity;
        if (dist <= dotR) {
          score = dist;
        } else if (Math.abs(dist - r) <= ringR) {
          score = dotR + Math.abs(dist - r);
        }
        if (score < Infinity && (!best || score < best.score)) {
          best = { spot, part, score };
        }
      };

      // Iterate newest → oldest so stacked spots prefer the latest created.
      for (let i = spots.length - 1; i >= 0; i--) {
        const spot = spots[i];
        const dst = toCanvas(spot.dst.x, spot.dst.y);
        const r = spot.radius * canvasWidth;
        consider(spot, 'dst', dst.x, dst.y, r);
        if (spot.mode !== 'fill') {
          const src = toCanvas(spot.src.x, spot.src.y);
          consider(spot, 'src', src.x, src.y, r);
        }
      }
      return best as { spot: HealSpot; part: 'dst' | 'src' } | null;
    },
    [spots, toCanvas, canvasWidth, zoom],
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
      // Empty canvas: create a single spot at the click point. Drag that
      // follows doesn't spawn a stroke — one click, one spot.
      const norm = toNorm(pos.x, pos.y);
      onSelectSpot(null);
      onAddSpot(norm.x, norm.y);
      dragRef.current = { type: 'idle' };
      isDraggingRef.current = false;
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

  const handleMouseUp = () => {
    isDraggingRef.current = false;
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

  const handleDeleteSpot = useCallback(() => {
    if (selectedSpotId) onDeleteSpot(selectedSpotId);
  }, [selectedSpotId, onDeleteSpot]);

  useShortcut([{ id: 'heal.delete-spot', handler: handleDeleteSpot }]);

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
