import { create } from 'zustand';

type CatalogStore = {
  photos: CatalogPhoto[];
  edits: Record<string, PhotoEdits>;
  selectedId: string | null;
  isLoaded: boolean;
  // actions
  initFromDisk: () => Promise<void>;
  saveToDisk: () => Promise<void>;
  addPhotos: (photos: CatalogPhoto[]) => void;
  setSelectedId: (id: string | null) => void;
  savePhotoEdits: (id: string, edits: PhotoEdits) => void;
  getPhotoEdits: (id: string) => PhotoEdits | undefined;
};

export const useCatalogStore = create<CatalogStore>((set, get) => ({
  photos: [],
  edits: {},
  selectedId: null,
  isLoaded: false,

  initFromDisk: async () => {
    const catalog = await window.electron.catalog.load();
    if (!catalog) {
      set({ isLoaded: true });
      return;
    }
    set({
      photos: catalog.photos ?? [],
      edits: catalog.edits ?? {},
      selectedId: catalog.selectedId ?? null,
      isLoaded: true,
    });
  },

  saveToDisk: async () => {
    const { photos, edits, selectedId, isLoaded } = get();
    if (!isLoaded) return; // never overwrite catalog before it's been read
    await window.electron.catalog.save({
      version: 1,
      photos,
      edits,
      selectedId,
      lastOpenedAt: Date.now(),
    });
  },

  addPhotos: (newPhotos) => {
    set((s) => {
      const ids = new Set(s.photos.map((p) => p.id));
      return { photos: [...s.photos, ...newPhotos.filter((p) => !ids.has(p.id))] };
    });
  },

  setSelectedId: (id) => set({ selectedId: id }),

  savePhotoEdits: (id, edits) => {
    set((s) => ({ edits: { ...s.edits, [id]: edits } }));
  },

  getPhotoEdits: (id) => get().edits[id],
}));
