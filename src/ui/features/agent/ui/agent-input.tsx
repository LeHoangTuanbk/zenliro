import { useState, useCallback, useRef, useEffect, type KeyboardEvent } from 'react';
import { useAgentStore } from '../store/agent-store';
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
  const [showAgentCount, setShowAgentCount] = useState(false);
  const [agentCount, setAgentCount] = useState(1);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const bottomBarRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on click outside
  useEffect(() => {
    if (!showModelMenu && !showAgentCount) return;
    const handler = (e: MouseEvent) => {
      if (bottomBarRef.current && !bottomBarRef.current.contains(e.target as Node)) {
        setShowModelMenu(false);
        setShowAgentCount(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showModelMenu, showAgentCount]);

  const modelId = useAgentStore((s) => s.modelId);
  const provider = useAgentStore((s) => s.provider);
  const models = useAgentStore((s) => s.models);
  const modelsLoaded = useAgentStore((s) => s.modelsLoaded);
  const setModelId = useAgentStore((s) => s.setModelId);
  const loadModelsAction = useAgentStore((s) => s.loadModels);
  const messages = useAgentStore((s) => s.messages);

  const referenceBase64 = useReferenceStore((s) => s.referenceBase64);
  const setReference = useReferenceStore((s) => s.setReference);
  const clearReference = useReferenceStore((s) => s.clear);

  const currentModel = models.find((m) => m.id === modelId) ?? models[0];
  const claudeModels = models.filter((m) => m.provider === 'claude');
  const codexModels = models.filter((m) => m.provider === 'codex');
  const hasMessages = messages.length > 0;

  // Load models dynamically on first render
  useEffect(() => {
    if (modelsLoaded) return;
    window.electron?.agent?.loadModels().then((loaded) => {
      if (loaded && loaded.length > 0) {
        loadModelsAction(
          loaded.map((m) => ({
            id: m.id,
            label: m.label,
            description: m.description,
            provider: m.provider as 'claude' | 'codex',
          })),
        );
      }
    });
  }, [modelsLoaded, loadModelsAction]);

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

  const processImageFile = async (file: File) => {
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

  const handlePaste = (e: React.ClipboardEvent) => {
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
  };

  const handleAttach = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = () => {
      const file = input.files?.[0];
      if (file) processImageFile(file);
    };
    input.click();
  };

  return (
    <div className="px-3 pb-3 pt-1 shrink-0 relative">
      {/* Reference preview */}
      {referenceBase64 && (
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
      )}

      <div className="rounded-[8px] border border-[#333] bg-[#222] focus-within:border-[#555] transition-colors overflow-visible relative">
        {/* Textarea */}
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

        {/* Bottom bar */}
        <div ref={bottomBarRef} className="flex items-center justify-between px-2 pb-1.5">
          <div className="flex items-center gap-1">
            {/* Model selector */}
            <div className="relative">
              <button
                onClick={() => {
                  setShowModelMenu(!showModelMenu);
                  setShowPresets(false);
                }}
                className="flex items-center gap-1 text-[10px] text-[#999] hover:text-[#ccc] transition-colors px-1 py-0.5"
              >
                <span>{currentModel?.label ?? modelId}</span>
                <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                  <path
                    d="M2 3l2 2 2-2"
                    stroke="currentColor"
                    strokeWidth="1.2"
                    strokeLinecap="round"
                  />
                </svg>
              </button>

              {showModelMenu && (
                <div className="absolute bottom-full left-0 mb-1 w-[160px] bg-[#2a2a2a] border border-[#444] rounded-[6px] shadow-xl overflow-hidden z-50 max-h-[300px] overflow-y-auto">
                  <div className="px-2.5 py-1 text-[9px] text-[#555] uppercase tracking-wider border-b border-[#333]">
                    Claude
                  </div>
                  {claudeModels.map((m) => {
                    const disabled = hasMessages && provider !== 'claude';
                    return (
                      <button
                        key={m.id}
                        disabled={disabled}
                        onClick={() => {
                          setModelId(m.id, 'claude');
                          setShowModelMenu(false);
                        }}
                        className={`w-full text-left px-2.5 py-1 text-[11px] ${
                          disabled
                            ? 'text-[#444] cursor-not-allowed'
                            : m.id === modelId
                              ? 'text-white bg-[#333]'
                              : 'text-[#aaa] hover:bg-[#333]'
                        }`}
                      >
                        {m.label}
                      </button>
                    );
                  })}
                  {codexModels.length > 0 && (
                    <>
                      <div className="px-2.5 py-1 text-[9px] text-[#555] uppercase tracking-wider border-b border-[#333] border-t">
                        Codex
                      </div>
                      {codexModels.map((m) => {
                        const disabled = hasMessages && provider !== 'codex';
                        return (
                          <button
                            key={m.id}
                            disabled={disabled}
                            onClick={() => {
                              setModelId(m.id, 'codex');
                              setShowModelMenu(false);
                            }}
                            className={`w-full text-left px-2.5 py-1 text-[11px] ${
                              disabled
                                ? 'text-[#444] cursor-not-allowed'
                                : m.id === modelId
                                  ? 'text-white bg-[#333]'
                                  : 'text-[#aaa] hover:bg-[#333]'
                            }`}
                          >
                            {m.label}
                          </button>
                        );
                      })}
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Parallel agents selector */}
            <div className="relative">
              <button
                onClick={() => {
                  setShowAgentCount(!showAgentCount);
                  setShowModelMenu(false);
                  setShowPresets(false);
                }}
                className="flex items-center gap-0.5 px-1 py-0.5 rounded text-[10px] font-medium text-[#f5c542] hover:text-[#ffd966] transition-colors"
                title="Parallel agents"
              >
                <svg width="10" height="12" viewBox="0 0 10 12" fill="none">
                  <path d="M6 0.5L1 7h4l-1 4.5L9 5H5.5L6 0.5z" fill="currentColor" />
                </svg>
                <span>{agentCount}x</span>
              </button>

              {showAgentCount && (
                <div className="absolute bottom-full left-0 mb-1 w-[160px] bg-[#2a2a2a] border border-[#444] rounded-[6px] shadow-xl overflow-hidden z-50">
                  <div className="px-3 py-1.5 text-[9px] text-[#666] uppercase tracking-wider border-b border-[#333]">
                    Parallel Agents
                  </div>
                  {[1, 2, 3, 4, 5, 6].map((n) => (
                    <button
                      key={n}
                      onClick={() => {
                        if (n === 1) {
                          setAgentCount(n);
                          setShowAgentCount(false);
                        }
                      }}
                      disabled={n > 1}
                      title={n > 1 ? 'Coming soon' : undefined}
                      className={`w-full text-left px-3 py-1 text-[11px] transition-colors ${
                        n === agentCount
                          ? 'text-white bg-[#333]'
                          : n > 1
                            ? 'text-[#444] cursor-not-allowed'
                            : 'text-[#aaa] hover:bg-[#333] hover:text-white'
                      }`}
                    >
                      {n}x
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1">
            {/* Attach file */}
            <button
              onClick={handleAttach}
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

            {/* Style presets browser */}
            <button
              onClick={() => {
                setShowPresets(true);
                setShowModelMenu(false);
              }}
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
                onApply={(prompt) => {
                  setShowPresets(false);
                  onSend(prompt);
                }}
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
                  <path
                    d="M6 10V2M6 2L2.5 5.5M6 2l3.5 3.5"
                    stroke={text.trim() ? '#1a1a1a' : '#666'}
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
