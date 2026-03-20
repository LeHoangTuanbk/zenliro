import { useCallback, useEffect, useRef, useState } from 'react';

export function useLibrary() {
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBulkDelete, setShowBulkDelete] = useState(false);
  const [isMetaHeld, setIsMetaHeld] = useState(false);
  const lastClickedIdRef = useRef<string | null>(null);
  // Track whether user actually clicked during meta hold
  const didClickDuringMetaRef = useRef(false);

  // Listen for Cmd/Ctrl key hold
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Meta' || e.key === 'Control') {
        setIsMetaHeld(true);
        didClickDuringMetaRef.current = false;
      }
      if (e.key === 'Escape') {
        setSelectedIds((prev) => (prev.size === 0 ? prev : new Set()));
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        setSelectedIds((prev) => {
          if (prev.size > 0) {
            setShowBulkDelete(true);
          }
          return prev;
        });
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Meta' || e.key === 'Control') {
        setIsMetaHeld(false);
        // If user didn't click anything while holding, clear selection
        if (!didClickDuringMetaRef.current) {
          setSelectedIds((prev) => (prev.size === 0 ? prev : new Set()));
        }
      }
    };
    // Also handle blur — if user switches window while holding key
    const handleBlur = () => setIsMetaHeld(false);

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
    };
  }, []);

  const openDeleteDialog = useCallback((id: string) => {
    setDeleteTargetId(id);
  }, []);

  const closeDeleteDialog = useCallback(() => {
    setDeleteTargetId(null);
  }, []);

  const handlePhotoClick = useCallback((id: string, e: React.MouseEvent, photoIds: string[]) => {
    const metaKey = e.metaKey || e.ctrlKey;
    const shiftKey = e.shiftKey;

    if (metaKey) {
      didClickDuringMetaRef.current = true;
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) {
          next.delete(id);
        } else {
          next.add(id);
        }
        return next;
      });
      lastClickedIdRef.current = id;
    } else if (shiftKey && lastClickedIdRef.current) {
      const lastIdx = photoIds.indexOf(lastClickedIdRef.current);
      const currIdx = photoIds.indexOf(id);
      if (lastIdx !== -1 && currIdx !== -1) {
        const from = Math.min(lastIdx, currIdx);
        const to = Math.max(lastIdx, currIdx);
        const range = photoIds.slice(from, to + 1);
        setSelectedIds((prev) => {
          const next = new Set(prev);
          range.forEach((pid) => next.add(pid));
          return next;
        });
      }
    } else {
      // If clicking a multi-selected photo without modifier, just remove it
      setSelectedIds((prev) => {
        if (prev.size > 0 && prev.has(id)) {
          const next = new Set(prev);
          next.delete(id);
          return next;
        }
        // No multi-selection or clicking unselected photo — clear all
        return prev.size === 0 ? prev : new Set();
      });
      lastClickedIdRef.current = id;
    }
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const openBulkDelete = useCallback(() => {
    setShowBulkDelete(true);
  }, []);

  const closeBulkDelete = useCallback(() => {
    setShowBulkDelete(false);
  }, []);

  return {
    deleteTargetId,
    selectedIds,
    showBulkDelete,
    isMetaHeld,
    openDeleteDialog,
    closeDeleteDialog,
    handlePhotoClick,
    clearSelection,
    openBulkDelete,
    closeBulkDelete,
  };
}
