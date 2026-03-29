import { create } from 'zustand';

let saveTimer: ReturnType<typeof setTimeout> | null = null;
let pendingSaveResolvers: Array<() => void> = [];

type CatalogStore = {
  photos: CatalogPhoto[];
  edits: Record<string, PhotoEdits>;
  collections: Collection[];
  libraryOrder: string[];
  selectedId: string | null;
  activeCollectionId: string | null;
  isLoaded: boolean;
  // photo actions
  initFromDisk: () => Promise<void>;
  saveToDisk: () => Promise<void>;
  addPhotos: (photos: CatalogPhoto[]) => void;
  setSelectedId: (id: string | null) => void;
  savePhotoEdits: (id: string, edits: PhotoEdits) => void;
  getPhotoEdits: (id: string) => PhotoEdits | undefined;
  deletePhoto: (id: string) => void;
  setPhotoRating: (id: string, rating: number) => void;
  setPhotoTags: (id: string, tags: string[]) => void;
  // library order
  reorderLibrary: (fromId: string, toId: string) => void;
  // collection actions
  setActiveCollectionId: (id: string | null) => void;
  addCollection: (name: string, parentId?: string | null) => string;
  renameCollection: (id: string, name: string) => void;
  deleteCollection: (id: string) => void;
  addPhotosToCollection: (collectionId: string, photoIds: string[]) => void;
  removePhotosFromCollection: (collectionId: string, photoIds: string[]) => void;
  movePhotosToCollection: (photoIds: string[], targetId: string | null) => void;
};

export const useCatalogStore = create<CatalogStore>((set, get) => ({
  photos: [],
  edits: {},
  collections: [],
  libraryOrder: [],
  selectedId: null,
  activeCollectionId: null,
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
    const collections = catalog.collections ?? [];
    // Build libraryOrder from saved data, or generate from existing items
    let libraryOrder = catalog.libraryOrder ?? [];
    if (libraryOrder.length === 0) {
      libraryOrder = [
        ...collections.map((c: Collection) => `collection:${c.id}`),
        ...photos.map((p: CatalogPhoto) => p.id),
      ];
    }
    set({
      photos,
      edits: catalog.edits ?? {},
      collections,
      libraryOrder,
      selectedId: catalog.selectedId ?? null,
      activeCollectionId: catalog.activeCollectionId ?? null,
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
        const {
          photos,
          edits,
          collections,
          libraryOrder,
          selectedId,
          activeCollectionId,
          isLoaded,
        } = get();
        if (isLoaded) {
          await window.electron.catalog.save({
            version: 1,
            photos,
            edits,
            collections,
            libraryOrder,
            selectedId,
            activeCollectionId,
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
      const added = newPhotos.filter((p) => !ids.has(p.id));
      return {
        photos: [...s.photos, ...added],
        libraryOrder: [...s.libraryOrder, ...added.map((p) => p.id)],
      };
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
        collections: s.collections.map((c) =>
          c.photoIds.includes(id) ? { ...c, photoIds: c.photoIds.filter((pid) => pid !== id) } : c,
        ),
        libraryOrder: s.libraryOrder.filter((entry) => entry !== id),
        selectedId: s.selectedId === id ? null : s.selectedId,
      };
    });
  },

  reorderLibrary: (fromId, toId) => {
    set((s) => {
      const order = [...s.libraryOrder];
      const fromIdx = order.indexOf(fromId);
      const toIdx = order.indexOf(toId);
      if (fromIdx === -1 || toIdx === -1) return s;
      const [moved] = order.splice(fromIdx, 1);
      order.splice(toIdx, 0, moved);
      return { libraryOrder: order };
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

  // ── Collections ──────────────────────────────────────────────────────────
  setActiveCollectionId: (id) => set({ activeCollectionId: id }),

  addCollection: (name, parentId = null) => {
    const id = crypto.randomUUID();
    set((s) => ({
      collections: [...s.collections, { id, name, parentId, photoIds: [], createdAt: Date.now() }],
      // Only add to libraryOrder if root-level
      libraryOrder: parentId ? s.libraryOrder : [...s.libraryOrder, `collection:${id}`],
    }));
    return id;
  },

  renameCollection: (id, name) => {
    set((s) => ({
      collections: s.collections.map((c) => (c.id === id ? { ...c, name } : c)),
    }));
  },

  deleteCollection: (id) => {
    set((s) => {
      // Collect all descendant IDs recursively
      const toDelete = new Set<string>();
      const collect = (parentId: string) => {
        toDelete.add(parentId);
        s.collections.filter((c) => c.parentId === parentId).forEach((c) => collect(c.id));
      };
      collect(id);
      return {
        collections: s.collections.filter((c) => !toDelete.has(c.id)),
        libraryOrder: s.libraryOrder.filter((entry) => {
          if (!entry.startsWith('collection:')) return true;
          return !toDelete.has(entry.replace('collection:', ''));
        }),
        activeCollectionId: toDelete.has(s.activeCollectionId ?? '') ? null : s.activeCollectionId,
      };
    });
  },

  addPhotosToCollection: (collectionId, photoIds) => {
    set((s) => ({
      collections: s.collections.map((c) => {
        if (c.id !== collectionId) return c;
        const existing = new Set(c.photoIds);
        const newIds = photoIds.filter((pid) => !existing.has(pid));
        return newIds.length > 0 ? { ...c, photoIds: [...c.photoIds, ...newIds] } : c;
      }),
    }));
  },

  removePhotosFromCollection: (collectionId, photoIds) => {
    const toRemove = new Set(photoIds);
    set((s) => ({
      collections: s.collections.map((c) =>
        c.id === collectionId
          ? { ...c, photoIds: c.photoIds.filter((pid) => !toRemove.has(pid)) }
          : c,
      ),
    }));
  },

  movePhotosToCollection: (photoIds, targetId) => {
    const toMove = new Set(photoIds);
    set((s) => {
      // Remove from all collections
      const collections = s.collections.map((c) => ({
        ...c,
        photoIds: c.photoIds.filter((pid) => !toMove.has(pid)),
      }));
      // Add to target collection (if not root)
      if (targetId) {
        const idx = collections.findIndex((c) => c.id === targetId);
        if (idx !== -1) {
          const existing = new Set(collections[idx].photoIds);
          const newIds = photoIds.filter((pid) => !existing.has(pid));
          collections[idx] = {
            ...collections[idx],
            photoIds: [...collections[idx].photoIds, ...newIds],
          };
        }
      }
      // Update libraryOrder: add to root if moving to root, remove from root if moving to collection
      let libraryOrder = s.libraryOrder;
      if (targetId === null) {
        // Moving to root — add IDs not already in libraryOrder
        const orderSet = new Set(libraryOrder);
        const toAdd = photoIds.filter((pid) => !orderSet.has(pid));
        libraryOrder = [...libraryOrder, ...toAdd];
      } else {
        // Moving to collection — remove from root libraryOrder
        libraryOrder = libraryOrder.filter((entry) => !toMove.has(entry));
      }
      return { collections, libraryOrder };
    });
  },
}));
