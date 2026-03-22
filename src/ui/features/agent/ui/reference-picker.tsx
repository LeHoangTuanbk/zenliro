import { useCallback } from 'react';
import { useReferenceStore } from '../store/reference-store';

const MAX_SIZE = 800;

export function ReferencePicker() {
  const referenceBase64 = useReferenceStore((s) => s.referenceBase64);
  const setReference = useReferenceStore((s) => s.setReference);
  const clear = useReferenceStore((s) => s.clear);

  const handlePick = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;

      const bitmap = await createImageBitmap(file);
      const scale = Math.min(1, MAX_SIZE / Math.max(bitmap.width, bitmap.height));
      const w = Math.round(bitmap.width * scale);
      const h = Math.round(bitmap.height * scale);

      const canvas = new OffscreenCanvas(w, h);
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(bitmap, 0, 0, w, h);
      bitmap.close();

      const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.8 });
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        setReference(dataUrl);
      };
      reader.readAsDataURL(blob);
    };
    input.click();
  }, [setReference]);

  if (referenceBase64) {
    return (
      <div className="flex items-center gap-1">
        <img
          src={referenceBase64}
          alt="Reference"
          className="w-6 h-6 rounded-[2px] object-cover border border-br-accent/40"
        />
        <button
          onClick={clear}
          className="text-[9px] text-br-muted hover:text-red-400"
          title="Remove reference"
        >
          ✕
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={handlePick}
      className="text-[9px] text-br-muted hover:text-br-text px-1 py-0.5 border border-br-elevated rounded-[2px]"
      title="Attach reference photo"
    >
      Ref
    </button>
  );
}
