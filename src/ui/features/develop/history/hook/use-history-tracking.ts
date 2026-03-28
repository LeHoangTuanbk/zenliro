import { useCallback, useEffect, useRef } from 'react';
import { createRendererLogger } from '@shared/lib/logger';
import { useAdjustmentsStore } from '@features/develop/edit/store/adjustments-store';

const log = createRendererLogger('history');
import { useToneCurveStore } from '@features/develop/edit/tone-curve/store/tone-curve-store';
import { useColorMixerStore } from '@features/develop/edit/color-mixer/store/color-mixer-store';
import { useColorGradingStore } from '@features/develop/edit/color-grading/store/color-grading-store';
import { useEffectsStore } from '@features/develop/edit/effects/model/effects-store';
import { useCropStore } from '@features/develop/crop/store/crop-store';
import { useHealStore } from '@features/develop/heal/store/heal-store';
import { useMaskStore } from '@/features/develop/mask';
import { useHistoryStore } from '../store/history-store';
import { captureSnapshot, applySnapshot } from '../lib/snapshot';
import { generateLabel } from '../lib/diff-label';
import { useShortcut } from '@shared/lib/shortcuts';
import type { EditSnapshot } from '../store/types';

const DEBOUNCE_MS = 400;

export function useHistoryTracking(photoId: string | null) {
  const lastSnapshotRef = useRef<EditSnapshot | null>(null);
  const photoIdRef = useRef(photoId);

  useEffect(() => {
    photoIdRef.current = photoId;
  }, [photoId]);

  // Push initial snapshot when photo is selected
  useEffect(() => {
    if (!photoId) {
      lastSnapshotRef.current = null;
      return;
    }
    // Small delay to let stores settle after photo switch
    const t = setTimeout(() => {
      const snap = captureSnapshot(photoId);
      lastSnapshotRef.current = snap;
      const store = useHistoryStore.getState();
      const h = store.getHistory(photoId);
      if (h.entries.length === 0) {
        store.push(photoId, 'Import', 'Initial state', snap);
      }
    }, 50);
    return () => clearTimeout(t);
  }, [photoId]);

  // Subscribe to all stores and debounce-push history entries
  useEffect(() => {
    if (!photoId) return;
    let timer: ReturnType<typeof setTimeout>;

    const onStoreChange = () => {
      const { isApplying } = useHistoryStore.getState();
      if (isApplying) return;

      clearTimeout(timer);
      timer = setTimeout(() => {
        const id = photoIdRef.current;
        if (!id) return;
        const snap = captureSnapshot(id);
        const diff = generateLabel(lastSnapshotRef.current, snap);
        if (diff.label === 'Edit' && lastSnapshotRef.current) {
          if (JSON.stringify(snap) === JSON.stringify(lastSnapshotRef.current)) return;
        }
        useHistoryStore.getState().push(id, diff.label, diff.details, snap);
        lastSnapshotRef.current = snap;
      }, DEBOUNCE_MS);
    };

    const unsubs = [
      useAdjustmentsStore.subscribe(onStoreChange),
      useToneCurveStore.subscribe(onStoreChange),
      useColorMixerStore.subscribe(onStoreChange),
      useColorGradingStore.subscribe(onStoreChange),
      useEffectsStore.subscribe(onStoreChange),
      useCropStore.subscribe(onStoreChange),
      useHealStore.subscribe(onStoreChange),
      useMaskStore.subscribe(onStoreChange),
    ];

    return () => {
      clearTimeout(timer);
      unsubs.forEach((u) => u());
    };
  }, [photoId]);

  const applyHistory = useCallback(
    (direction: 'undo' | 'redo') => {
      const id = photoIdRef.current;
      if (!id) return;
      const store = useHistoryStore.getState();
      const snapshot = direction === 'redo' ? store.redo(id) : store.undo(id);
      if (!snapshot) return;
      log.info(`${direction === 'undo' ? 'Undo' : 'Redo'} applied`);
      store.setIsApplying(true);
      applySnapshot(id, snapshot);
      lastSnapshotRef.current = structuredClone(snapshot);
      requestAnimationFrame(() => store.setIsApplying(false));
    },
    [],
  );

  const handleUndo = useCallback(() => applyHistory('undo'), [applyHistory]);
  const handleRedo = useCallback(() => applyHistory('redo'), [applyHistory]);

  useShortcut([
    { id: 'global.undo', handler: handleUndo },
    { id: 'global.redo', handler: handleRedo },
  ]);
}
