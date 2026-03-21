import { useState } from 'react';

type AgentThinkingProps = {
  text: string;
};

export function AgentThinking({ text }: AgentThinkingProps) {
  const [isOpen, setIsOpen] = useState(false);

  if (!text) return null;

  return (
    <button
      type="button"
      className="w-full text-left mt-1 text-[10px]"
      onClick={() => setIsOpen(!isOpen)}
    >
      <span className="text-br-muted hover:text-br-text cursor-pointer">
        {isOpen ? '▾' : '▸'} Thinking...
      </span>
      {isOpen && (
        <pre className="mt-1 text-[10px] text-br-muted/70 whitespace-pre-wrap break-words max-h-[100px] overflow-y-auto">
          {text}
        </pre>
      )}
    </button>
  );
}
