import { useState, useCallback, useRef, type KeyboardEvent } from 'react';
import { ReferencePicker } from './reference-picker';

type AgentInputProps = {
  isStreaming: boolean;
  onSend: (text: string) => void;
  onStop: () => void;
};

export function AgentInput({ isStreaming, onSend, onStop }: AgentInputProps) {
  const [text, setText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed || isStreaming) return;
    onSend(trimmed);
    setText('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  }, [text, isStreaming, onSend]);

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInput = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 100)}px`;
  };

  return (
    <div className="px-3 pb-3 pt-1 shrink-0">
      <div className="relative rounded-[8px] border border-[#333] bg-[#222] focus-within:border-[#555] transition-colors">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          onInput={handleInput}
          placeholder="Edit your photo with AI..."
          rows={1}
          className="w-full bg-transparent text-[#ddd] text-[12px] px-3 pt-2.5 pb-8 resize-none focus:outline-none placeholder:text-[#555]"
        />

        {/* Bottom bar inside input */}
        <div className="absolute bottom-1.5 left-1.5 right-1.5 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <ReferencePicker />
          </div>

          <div className="flex items-center gap-1.5">
            {isStreaming ? (
              <button
                onClick={onStop}
                className="w-6 h-6 flex items-center justify-center rounded-full bg-[#555] hover:bg-[#666] transition-colors"
                title="Stop"
              >
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <rect x="1" y="1" width="8" height="8" rx="1" fill="#ddd" />
                </svg>
              </button>
            ) : (
              <button
                onClick={handleSend}
                disabled={!text.trim()}
                className="w-6 h-6 flex items-center justify-center rounded-full bg-[#e0e0e0] hover:bg-white disabled:bg-[#333] disabled:cursor-not-allowed transition-colors"
                title="Send"
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M6 10V2M6 2L2.5 5.5M6 2l3.5 3.5" stroke={text.trim() ? '#1a1a1a' : '#666'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
