import type { CropRect } from '../store/types';

export type DragHandle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'move';

/** Rect after dragging `handle` by (dx, dy) from `sr`. Corner drags keep the ratio when locked. */
export function dragRect(
  handle: DragHandle,
  sr: CropRect,
  dx: number,
  dy: number,
  lockAspect: boolean,
): CropRect {
  const r: CropRect = { ...sr };
  const aspect = lockAspect ? sr.w / sr.h : null;

  switch (handle) {
    case 'move':
      r.x = sr.x + dx;
      r.y = sr.y + dy;
      break;
    case 'nw':
      r.x = sr.x + dx;
      r.w = sr.w - dx;
      r.y = sr.y + dy;
      r.h = sr.h - dy;
      if (aspect) r.h = r.w / aspect;
      break;
    case 'ne':
      r.w = sr.w + dx;
      r.y = sr.y + dy;
      r.h = sr.h - dy;
      if (aspect) r.h = r.w / aspect;
      break;
    case 'se':
      r.w = sr.w + dx;
      r.h = sr.h + dy;
      if (aspect) r.h = r.w / aspect;
      break;
    case 'sw':
      r.x = sr.x + dx;
      r.w = sr.w - dx;
      r.h = sr.h + dy;
      if (aspect) r.h = r.w / aspect;
      break;
    // Edge handles: only affect their own axis — no aspect enforcement
    case 'n':
      r.y = sr.y + dy;
      r.h = sr.h - dy;
      break;
    case 's':
      r.h = sr.h + dy;
      break;
    case 'e':
      r.w = sr.w + dx;
      break;
    case 'w':
      r.x = sr.x + dx;
      r.w = sr.w - dx;
      break;
  }
  return r;
}
