import { useState, useCallback, useRef, type KeyboardEvent } from 'react';
import { useAgentStore, AGENT_MODELS } from '../store/agent-store';
import { useReferenceStore } from '../store/reference-store';
import { PresetBrowser } from './preset-browser';

type AgentInputProps = {
  isStreaming: boolean;
  onSend: (text: string) => void;
  onStop: () => void;
};

export function AgentInput({ isStreaming, onSend, onStop }: AgentInputProps) {
  const [text, setText] = useState('');
  const [showModelMenu, setShowModelMenu] = useState(false);
  const [showPresets, setShowPresets] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const modelId = useAgentStore((s) => s.modelId);
  const fastMode = useAgentStore((s) => s.fastMode);
  const setModelId = useAgentStore((s) => s.setModelId);
  const toggleFastMode = useAgentStore((s) => s.toggleFastMode);

  const referenceBase64 = useReferenceStore((s) => s.referenceBase64);
  const setReference = useReferenceStore((s) => s.setReference);
  const clearReference = useReferenceStore((s) => s.clear);

  const currentModel = AGENT_MODELS.find((m) => m.id === modelId) ?? AGENT_MODELS[0];

  const handleSend = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed || isStreaming) return;
    onSend(trimmed);
    setText('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  }, [text, isStreaming, onSend]);

  const handleKeyDown = (e: KeyboardEvent) => {
    e.stopPropagation();
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
    if (e.key === 'Escape') {
      setShowModelMenu(false);
      setShowPresets(false);
    }
  };

  const handleInput = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 100)}px`;
  };

  const handleAttach = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
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
    };
    input.click();
  };

  return (
    <div className="px-3 pb-3 pt-1 shrink-0 relative">
      {/* Reference preview */}
      {referenceBase64 && (
        <div className="flex items-center gap-2 mb-1.5 px-1">
          <img src={referenceBase64} alt="Ref" className="w-8 h-8 rounded-[4px] object-cover border border-[#444]" />
          <span className="text-[10px] text-[#888]">Reference attached</span>
          <button onClick={clearReference} className="text-[10px] text-[#666] hover:text-red-400 ml-auto">✕</button>
        </div>
      )}

      <div className="rounded-[8px] border border-[#333] bg-[#222] focus-within:border-[#555] transition-colors overflow-visible relative">
        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          onInput={handleInput}
          placeholder="Edit your photo with AI..."
          rows={1}
          className="w-full bg-transparent text-[#ddd] text-[12px] px-3 pt-2.5 pb-2 resize-none focus:outline-none placeholder:text-[#555]"
        />

        {/* Bottom bar */}
        <div className="flex items-center justify-between px-2 pb-1.5">
          <div className="flex items-center gap-1">
            {/* Model selector */}
            <div className="relative">
              <button
                onClick={() => { setShowModelMenu(!showModelMenu); setShowPresets(false); }}
                className="flex items-center gap-1 text-[10px] text-[#999] hover:text-[#ccc] transition-colors px-1 py-0.5"
              >
                <span>{currentModel.label.replace('Claude ', '')}</span>
                <span className="text-[9px] text-[#666]">({currentModel.tag})</span>
                <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                  <path d="M2 3l2 2 2-2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                </svg>
              </button>

              {showModelMenu && (
                <div className="absolute bottom-full left-0 mb-1 w-[180px] bg-[#2a2a2a] border border-[#444] rounded-[6px] shadow-xl overflow-hidden z-50">
                  {AGENT_MODELS.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => { setModelId(m.id); setShowModelMenu(false); }}
                      className={`w-full flex items-center justify-between px-3 py-1.5 text-[11px] hover:bg-[#333] transition-colors ${
                        m.id === modelId ? 'text-white' : 'text-[#aaa]'
                      }`}
                    >
                      <span>{m.label}</span>
                      <span className="text-[9px] text-[#666]">{m.tag}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* 2x speed toggle */}
            <button
              onClick={toggleFastMode}
              className={`flex items-center gap-0.5 px-1 py-0.5 rounded text-[10px] font-medium transition-colors ${
                fastMode ? 'text-[#f5c542]' : 'text-[#666] hover:text-[#999]'
              }`}
              title={fastMode ? 'Fast mode ON' : 'Fast mode OFF'}
            >
              <svg width="10" height="12" viewBox="0 0 10 12" fill="none">
                <path d="M6 0.5L1 7h4l-1 4.5L9 5H5.5L6 0.5z" fill={fastMode ? '#f5c542' : 'currentColor'} />
              </svg>
              <span>2x</span>
            </button>
          </div>

          <div className="flex items-center gap-1">
            {/* Attach file */}
            <button
              onClick={handleAttach}
              className="w-6 h-6 flex items-center justify-center text-[#666] hover:text-[#999] transition-colors"
              title="Attach reference image"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M7.5 3.5v6a2 2 0 01-4 0V4a1.25 1.25 0 012.5 0v5a.5.5 0 01-1 0V4.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
              </svg>
            </button>

            {/* Style presets browser */}
            <button
              onClick={() => { setShowPresets(true); setShowModelMenu(false); }}
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

            {showPresets && (
              <PresetBrowser
                onApply={(prompt) => { setShowPresets(false); onSend(prompt); }}
                onClose={() => setShowPresets(false)}
              />
            )}

            {/* Send / Stop */}
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
