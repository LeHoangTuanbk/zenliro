import { useCallback, useRef, useState, type KeyboardEvent } from 'react';
import { InputBottomBar } from './input/input-bottom-bar';
import { ReferencePreview } from './input/reference-preview';
import { useImageReference } from './input/use-image-reference';
import { useLoadModels } from './input/use-load-models';

type AgentInputProps = {
  isStreaming: boolean;
  onSend: (text: string) => void;
  onStop: () => void;
};

export function AgentInput({ isStreaming, onSend, onStop }: AgentInputProps) {
  const [text, setText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { handlePaste, handleAttach } = useImageReference();
  useLoadModels();

  const handleSend = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed || isStreaming) return;
    onSend(trimmed);
    setText('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  }, [text, isStreaming, onSend]);

  const handleKeyDown = (e: KeyboardEvent) => {
    e.stopPropagation();
    e.nativeEvent.stopImmediatePropagation();
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
    <div className="px-3 pb-3 pt-1 shrink-0 relative">
      <ReferencePreview />
      <div className="rounded-[8px] border border-[#333] bg-[#222] focus-within:border-[#555] transition-colors overflow-visible relative">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          onInput={handleInput}
          onPaste={handlePaste}
          placeholder="Edit your photo with AI..."
          rows={1}
          className="w-full bg-transparent text-[#ddd] text-[12px] px-3 pt-2.5 pb-2 resize-none focus:outline-none placeholder:text-[#555]"
        />
        <InputBottomBar
          isStreaming={isStreaming}
          canSend={Boolean(text.trim())}
          onAttach={handleAttach}
          onSend={handleSend}
          onStop={onStop}
          onApplyPreset={onSend}
        />
      </div>
    </div>
  );
}
