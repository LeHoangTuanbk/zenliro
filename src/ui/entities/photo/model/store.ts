import { create } from 'zustand';
import type { Photo } from './types';

interface PhotoStore {
  photos: Photo[];
  selectedPhotoId: string | null;
  addPhotos: (photos: Photo[]) => void;
  selectPhoto: (id: string | null) => void;
}

export const usePhotoStore = create<PhotoStore>((set) => ({
  photos: [],
  selectedPhotoId: null,
  addPhotos: (incoming) =>
    set((state) => {
      const existingIds = new Set(state.photos.map((p) => p.id));
      const newPhotos = incoming.filter((p) => !existingIds.has(p.id));
      return { photos: [...state.photos, ...newPhotos] };
    }),
  selectPhoto: (id) => set({ selectedPhotoId: id }),
}));
