import { create } from 'zustand';

let saveTimer: ReturnType<typeof setTimeout> | null = null;
let pendingSaveResolvers: Array<() => void> = [];

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
  deletePhoto: (id: string) => void;
  reorderPhotos: (fromIndex: number, toIndex: number) => void;
  setPhotoRating: (id: string, rating: number) => void;
  setPhotoTags: (id: string, tags: string[]) => void;
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
    const photos = (catalog.photos ?? []).map((p: CatalogPhoto) => ({
      ...p,
      thumbnailPath: p.thumbnailPath ?? '',
      orientation: p.orientation ?? 1,
      rating: p.rating ?? 0,
      tags: p.tags ?? [],
    }));
    set({
      photos,
      edits: catalog.edits ?? {},
      selectedId: catalog.selectedId ?? null,
      isLoaded: true,
    });
  },

  saveToDisk: async () => {
    return new Promise<void>((resolve) => {
      pendingSaveResolvers.push(resolve);

      if (saveTimer) {
        clearTimeout(saveTimer);
      }

      saveTimer = setTimeout(async () => {
        saveTimer = null;
        const { photos, edits, selectedId, isLoaded } = get();
        if (isLoaded) {
          await window.electron.catalog.save({
            version: 1,
            photos,
            edits,
            selectedId,
            lastOpenedAt: Date.now(),
          });
        }

        const resolvers = pendingSaveResolvers;
        pendingSaveResolvers = [];
        resolvers.forEach((done) => done());
      }, 250);
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

  deletePhoto: (id) => {
    set((s) => {
      const { [id]: _removed, ...restEdits } = s.edits;
      return {
        photos: s.photos.filter((p) => p.id !== id),
        edits: restEdits,
        selectedId: s.selectedId === id ? null : s.selectedId,
      };
    });
  },

  reorderPhotos: (fromIndex, toIndex) => {
    set((s) => {
      const next = [...s.photos];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return { photos: next };
    });
  },

  setPhotoRating: (id, rating) => {
    set((s) => ({
      photos: s.photos.map((p) => (p.id === id ? { ...p, rating } : p)),
    }));
  },

  setPhotoTags: (id, tags) => {
    set((s) => ({
      photos: s.photos.map((p) => (p.id === id ? { ...p, tags } : p)),
    }));
  },
}));
