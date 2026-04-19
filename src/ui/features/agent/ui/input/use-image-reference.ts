import { useCallback } from 'react';
import { useReferenceStore } from '../../store/reference-store';

// Compress + persist the dropped/pasted/attached image as a reference blob in
// the reference-store. Capped at 800px on the longest side and re-encoded as
// JPEG q=0.8 so the base64 payload stays small when shipped to the model.
export function useImageReference() {
  const setReference = useReferenceStore((s) => s.setReference);

  const processImageFile = useCallback(
    async (file: File) => {
      const bitmap = await createImageBitmap(file);
      const scale = Math.min(1, 800 / Math.max(bitmap.width, bitmap.height));
      const w = Math.round(bitmap.width * scale);
      const h = Math.round(bitmap.height * scale);
      const canvas = new OffscreenCanvas(w, h);
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(bitmap, 0, 0, w, h);
      bitmap.close();
      const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.8 });
      const reader = new FileReader();
      reader.onload = () => setReference(reader.result as string);
      reader.readAsDataURL(blob);
    },
    [setReference],
  );

  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          e.preventDefault();
          const file = item.getAsFile();
          if (file) processImageFile(file);
          return;
        }
      }
    },
    [processImageFile],
  );

  const handleAttach = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = () => {
      const file = input.files?.[0];
      if (file) processImageFile(file);
    };
    input.click();
  }, [processImageFile]);

  return { processImageFile, handlePaste, handleAttach };
}
