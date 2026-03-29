import type { HistoryEntry } from '../store/types';

type PhotoHistory = {
  entries: HistoryEntry[];
  currentIndex: number;
};

export async function loadHistory(photoId: string): Promise<PhotoHistory | null> {
  try {
    const data = await window.electron.history.load(photoId);
    return (data as PhotoHistory) ?? null;
  } catch {
    return null;
  }
}

export async function saveHistory(photoId: string, history: PhotoHistory): Promise<void> {
  try {
    await window.electron.history.save(photoId, history);
  } catch {
    // Best-effort persistence
  }
}

export async function deleteHistory(photoId: string): Promise<void> {
  try {
    await window.electron.history.delete(photoId);
  } catch {
    // Best-effort
  }
}
