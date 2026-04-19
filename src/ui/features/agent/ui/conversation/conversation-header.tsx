import type React from 'react';
import { IconButton } from './icon-button';
import type { PanelMode } from './actor-style';

type ConversationHeaderProps = {
  mode: PanelMode;
  onMouseDown: (e: React.MouseEvent) => void;
  onMinimize: () => void;
  onMaximize: () => void;
  onRestore: () => void;
  onClose: () => void;
};

export function ConversationHeader({
  mode,
  onMouseDown,
  onMinimize,
  onMaximize,
  onRestore,
  onClose,
}: ConversationHeaderProps) {
  const isMax = mode === 'maximized';
  return (
    <div
      onMouseDown={onMouseDown}
      style={{ cursor: isMax ? 'default' : 'move' }}
      className="flex items-center justify-between px-3 py-2 border-b border-[#333] shrink-0 select-none"
    >
      <span className="text-[11px] font-semibold text-white">Agent Conversation</span>
      <div className="flex items-center gap-0.5">
        <IconButton title="Minimize" onClick={onMinimize}>
          <path d="M2 8h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </IconButton>
        {isMax ? <RestoreButton onClick={onRestore} /> : <MaximizeButton onClick={onMaximize} />}
        <IconButton title="Close (Esc)" onClick={onClose}>
          <path
            d="M2 2L10 10M10 2L2 10"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </IconButton>
      </div>
    </div>
  );
}

function MaximizeButton({ onClick }: { onClick: () => void }) {
  return (
    <IconButton title="Maximize" onClick={onClick}>
      <rect
        x="2"
        y="2"
        width="8"
        height="8"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
        rx="1"
      />
    </IconButton>
  );
}

function RestoreButton({ onClick }: { onClick: () => void }) {
  return (
    <IconButton title="Restore" onClick={onClick}>
      <rect
        x="2"
        y="2"
        width="6"
        height="6"
        stroke="currentColor"
        strokeWidth="1.2"
        fill="none"
        rx="1"
      />
      <rect
        x="4"
        y="4"
        width="6"
        height="6"
        stroke="currentColor"
        strokeWidth="1.2"
        fill="none"
        rx="1"
      />
    </IconButton>
  );
}
