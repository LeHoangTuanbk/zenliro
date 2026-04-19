import { useReferenceStore } from '../../store/reference-store';

export function ReferencePreview() {
  const referenceBase64 = useReferenceStore((s) => s.referenceBase64);
  const clearReference = useReferenceStore((s) => s.clear);
  if (!referenceBase64) return null;
  return (
    <div className="flex items-center gap-2 mb-1.5 px-1">
      <img
        src={referenceBase64}
        alt="Ref"
        className="w-8 h-8 rounded-[4px] object-cover border border-[#444]"
      />
      <span className="text-[10px] text-[#888]">Reference attached</span>
      <button
        onClick={clearReference}
        className="text-[10px] text-[#666] hover:text-red-400 ml-auto"
      >
        ✕
      </button>
    </div>
  );
}
