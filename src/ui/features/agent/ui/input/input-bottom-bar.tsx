import { useEffect, useRef, useState } from 'react';
import { PresetBrowser } from '../preset-browser';
import { InputActionButtons } from './input-action-buttons';
import { ModelDropdown } from './model-dropdown';
import { TeamPresetDropdown } from './team-preset-dropdown';

type InputBottomBarProps = {
  isStreaming: boolean;
  canSend: boolean;
  onAttach: () => void;
  onSend: () => void;
  onStop: () => void;
  onApplyPreset: (prompt: string) => void;
};

export function InputBottomBar({
  isStreaming,
  canSend,
  onAttach,
  onSend,
  onStop,
  onApplyPreset,
}: InputBottomBarProps) {
  const [showModelMenu, setShowModelMenu] = useState(false);
  const [showPresets, setShowPresets] = useState(false);
  const [showAgentCount, setShowAgentCount] = useState(false);
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showModelMenu && !showAgentCount) return;
    const handler = (e: MouseEvent) => {
      if (barRef.current && !barRef.current.contains(e.target as Node)) {
        setShowModelMenu(false);
        setShowAgentCount(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showModelMenu, showAgentCount]);

  return (
    <div ref={barRef} className="flex items-center justify-between px-2 pb-1.5">
      <div className="flex items-center gap-1">
        <ModelDropdown
          open={showModelMenu}
          onToggle={() => {
            setShowModelMenu((v) => !v);
            setShowPresets(false);
          }}
          onSelect={() => setShowModelMenu(false)}
        />
        <TeamPresetDropdown
          open={showAgentCount}
          onToggle={() => {
            setShowAgentCount((v) => !v);
            setShowModelMenu(false);
            setShowPresets(false);
          }}
          onPicked={() => setShowAgentCount(false)}
        />
      </div>
      <InputActionButtons
        isStreaming={isStreaming}
        canSend={canSend}
        onAttach={onAttach}
        onOpenPresets={() => {
          setShowPresets(true);
          setShowModelMenu(false);
        }}
        onSend={onSend}
        onStop={onStop}
      />
      {showPresets && (
        <PresetBrowser
          onApply={(prompt) => {
            setShowPresets(false);
            onApplyPreset(prompt);
          }}
          onClose={() => setShowPresets(false)}
        />
      )}
    </div>
  );
}
