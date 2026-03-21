import { useState } from 'react';
import type { AgentToolCall } from '../store/agent-store';

const TOOL_LABELS: Record<string, string> = {
  get_screenshot: 'Analyzing photo...',
  get_edit_state: 'Reading edit state',
  get_photo_info: 'Getting photo info',
  set_adjustments: 'Adjustments',
  set_tone_curve: 'Tone Curve',
  set_color_mixer: 'Color Mixer',
  set_color_grading: 'Color Grading',
  set_effects: 'Effects',
  reset_all: 'Reset All',
};

type AgentToolCallBadgeProps = {
  toolCall: AgentToolCall;
};

export function AgentToolCallBadge({ toolCall }: AgentToolCallBadgeProps) {
  const [expanded, setExpanded] = useState(false);
  const label = TOOL_LABELS[toolCall.name] ?? toolCall.name;

  return (
    <div className="my-1">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-3 py-1.5 rounded-[6px] border border-[#333] bg-[#222] hover:bg-[#282828] transition-colors text-left"
      >
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-[#ccc]">{label}</span>
          {toolCall.status === 'pending' ? (
            <span className="w-3.5 h-3.5 rounded-full border-2 border-[#555] border-t-[#c89b3c] animate-spin" />
          ) : (
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <circle cx="7" cy="7" r="6" fill="#2d8a4e" />
              <path d="M4 7l2 2 4-4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </div>
        <svg
          width="12" height="12" viewBox="0 0 12 12" fill="none"
          className={`text-[#555] transition-transform ${expanded ? 'rotate-180' : ''}`}
        >
          <path d="M3 4.5l3 3 3-3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {expanded && toolCall.params && (
        <pre className="mt-1 mx-1 px-2 py-1.5 text-[9px] text-[#888] bg-[#1a1a1a] rounded-[4px] overflow-x-auto max-h-[80px] overflow-y-auto">
          {JSON.stringify(toolCall.params, null, 2)}
        </pre>
      )}
    </div>
  );
}
