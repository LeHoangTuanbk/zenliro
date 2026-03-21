import { useState, useCallback, useRef, type KeyboardEvent } from 'react';

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
    el.style.height = `${Math.min(el.scrollHeight, 80)}px`;
  };

  return (
    <div className="flex items-end gap-1.5 p-2 border-t border-black/50">
      <textarea
        ref={textareaRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        onInput={handleInput}
        placeholder="Ask AI to edit your photo..."
        rows={1}
        className="flex-1 bg-br-input text-br-text text-[11px] px-2 py-1.5 rounded-[3px] border border-br-elevated resize-none focus:outline-none focus:border-br-accent/50 placeholder:text-br-muted/50"
      />
      {isStreaming ? (
        <button
          onClick={onStop}
          className="px-2 py-1.5 text-[10px] bg-red-500/20 text-red-400 border border-red-500/30 rounded-[3px] hover:bg-red-500/30 transition-colors shrink-0"
        >
          Stop
        </button>
      ) : (
        <button
          onClick={handleSend}
          disabled={!text.trim()}
          className="px-2 py-1.5 text-[10px] bg-br-accent/20 text-br-accent border border-br-accent/30 rounded-[3px] hover:bg-br-accent/30 transition-colors disabled:opacity-30 disabled:cursor-not-allowed shrink-0"
        >
          Send
        </button>
      )}
    </div>
  );
}
