type InputActionButtonsProps = {
  isStreaming: boolean;
  canSend: boolean;
  onAttach: () => void;
  onOpenPresets: () => void;
  onSend: () => void;
  onStop: () => void;
};

export function InputActionButtons({
  isStreaming,
  canSend,
  onAttach,
  onOpenPresets,
  onSend,
  onStop,
}: InputActionButtonsProps) {
  return (
    <div className="flex items-center gap-1">
      <button
        onClick={onAttach}
        className="w-6 h-6 flex items-center justify-center text-[#666] hover:text-[#999] transition-colors"
        title="Attach reference image"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path
            d="M7.5 3.5v6a2 2 0 01-4 0V4a1.25 1.25 0 012.5 0v5a.5.5 0 01-1 0V4.5"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinecap="round"
          />
        </svg>
      </button>
      <button
        onClick={onOpenPresets}
        className="w-6 h-6 flex items-center justify-center text-[#666] hover:text-[#999] transition-colors"
        title="Style presets"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <circle cx="4" cy="4" r="1.5" stroke="currentColor" strokeWidth="1.1" />
          <circle cx="10" cy="4" r="1.5" stroke="currentColor" strokeWidth="1.1" />
          <circle cx="4" cy="10" r="1.5" stroke="currentColor" strokeWidth="1.1" />
          <circle cx="10" cy="10" r="1.5" stroke="currentColor" strokeWidth="1.1" />
        </svg>
      </button>
      {isStreaming ? (
        <button
          onClick={onStop}
          className="w-6 h-6 flex items-center justify-center rounded-full bg-[#555] hover:bg-[#666] transition-colors"
          title="Stop"
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <rect x="2" y="2" width="6" height="6" rx="1" fill="#ddd" />
          </svg>
        </button>
      ) : (
        <button
          onClick={onSend}
          disabled={!canSend}
          className="w-6 h-6 flex items-center justify-center rounded-full bg-[#e0e0e0] hover:bg-white disabled:bg-[#333] disabled:cursor-not-allowed transition-colors"
          title="Send"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path
              d="M6 10V2M6 2L2.5 5.5M6 2l3.5 3.5"
              stroke={canSend ? '#1a1a1a' : '#666'}
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      )}
    </div>
  );
}
