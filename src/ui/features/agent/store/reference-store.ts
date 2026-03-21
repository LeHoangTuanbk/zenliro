import { create } from 'zustand';

type ReferenceStore = {
  referenceBase64: string | null;
  referenceDescription: string;
  setReference: (base64: string | null) => void;
  setDescription: (desc: string) => void;
  clear: () => void;
};

export const useReferenceStore = create<ReferenceStore>((set) => ({
  referenceBase64: null,
  referenceDescription: '',
  setReference: (referenceBase64) => set({ referenceBase64 }),
  setDescription: (referenceDescription) => set({ referenceDescription }),
  clear: () => set({ referenceBase64: null, referenceDescription: '' }),
}));
