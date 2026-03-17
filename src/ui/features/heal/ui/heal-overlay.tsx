import { useCallback, useEffect, useRef, useState } from 'react';
import type { HealSpot } from '../model/types';

interface DragState {
  type: 'idle' | 'dragging-dst' | 'dragging-src';
  spotId?: string;
}

export interface HealOverlayProps {
  canvasWidth: number;
  canvasHeight: number;
  spots: HealSpot[];
  selectedSpotId: string | null;
  brushRadius: number;
  activeMode: 'heal' | 'clone';
  onAddSpot: (normX: number, normY: number) => void;
  onMoveSpotDst: (id: string, normX: number, normY: number) => void;
  onMoveSpotSrc: (id: string, normX: number, normY: number) => void;
  onSelectSpot: (id: string | null) => void;
  onDeleteSpot: (id: string) => void;
  onBrushRadiusChange: (r: number) => void;
}

const HIT_R_PX = 10; // px tolerance for clicking on a circle

export function HealOverlay({
  canvasWidth,
  canvasHeight,
  spots,
  selectedSpotId,
  brushRadius,
  activeMode: _activeMode,
  onAddSpot,
  onMoveSpotDst,
  onMoveSpotSrc,
  onSelectSpot,
  onDeleteSpot,
  onBrushRadiusChange,
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

    ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    const dispR = brushRadius * canvasWidth;

    for (const spot of spots) {
      const dst = toCanvas(spot.dst.x, spot.dst.y);
      const src = toCanvas(spot.src.x, spot.src.y);
      const r = spot.radius * canvasWidth;
      const isSelected = spot.id === selectedSpotId;
      const col = isSelected ? '#4d9fec' : 'rgba(255,255,255,0.85)';
      const lw = isSelected ? 2 : 1.5;

      // Connecting line
      ctx.beginPath();
      ctx.moveTo(dst.x, dst.y);
      ctx.lineTo(src.x, src.y);
      ctx.strokeStyle = isSelected ? 'rgba(77,159,236,0.6)' : 'rgba(255,255,255,0.35)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 3]);
      ctx.stroke();
      ctx.setLineDash([]);

      // Dst circle (solid)
      ctx.beginPath();
      ctx.arc(dst.x, dst.y, r, 0, Math.PI * 2);
      ctx.strokeStyle = col;
      ctx.lineWidth = lw;
      ctx.stroke();

      // Dst center dot
      ctx.beginPath();
      ctx.arc(dst.x, dst.y, 2.5, 0, Math.PI * 2);
      ctx.fillStyle = col;
      ctx.fill();

      // Src circle (dashed)
      ctx.beginPath();
      ctx.arc(src.x, src.y, r, 0, Math.PI * 2);
      ctx.strokeStyle = col;
      ctx.lineWidth = lw;
      ctx.setLineDash([4, 3]);
      ctx.stroke();
      ctx.setLineDash([]);

      // Arrow on src circle pointing toward dst
      const angle = Math.atan2(dst.y - src.y, dst.x - src.x);
      const ax = src.x + Math.cos(angle) * r;
      const ay = src.y + Math.sin(angle) * r;
      const al = Math.max(6, r * 0.35);
      ctx.beginPath();
      ctx.moveTo(ax - Math.cos(angle - 0.45) * al, ay - Math.sin(angle - 0.45) * al);
      ctx.lineTo(ax, ay);
      ctx.lineTo(ax - Math.cos(angle + 0.45) * al, ay - Math.sin(angle + 0.45) * al);
      ctx.strokeStyle = col;
      ctx.lineWidth = lw;
      ctx.stroke();
    }

    // Cursor brush ring
    if (mousePos && dragRef.current.type === 'idle') {
      ctx.beginPath();
      ctx.arc(mousePos.x, mousePos.y, dispR, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255,255,255,0.75)';
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(mousePos.x, mousePos.y, 2, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.fill();
    }
  }, [spots, selectedSpotId, mousePos, brushRadius, canvasWidth, canvasHeight, toCanvas]);

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
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.005 : 0.005;
    onBrushRadiusChange(Math.max(0.01, Math.min(0.25, brushRadius + delta)));
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
      width={canvasWidth}
      height={canvasHeight}
      style={{ cursor: 'none', touchAction: 'none' }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
      onWheel={handleWheel}
    />
  );
}
