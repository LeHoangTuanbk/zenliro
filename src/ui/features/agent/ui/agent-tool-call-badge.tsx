import type { AgentToolCall } from '../store/agent-store';

const STATUS_COLORS = {
  pending: 'bg-yellow-500/20 text-yellow-400',
  done: 'bg-green-500/20 text-green-400',
  error: 'bg-red-500/20 text-red-400',
} as const;

const TOOL_LABELS: Record<string, string> = {
  get_screenshot: 'Screenshot',
  get_edit_state: 'Read State',
  get_photo_info: 'Photo Info',
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
  const label = TOOL_LABELS[toolCall.name] ?? toolCall.name;
  const colorClass = STATUS_COLORS[toolCall.status];

  return (
    <span
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-medium ${colorClass}`}
    >
      {toolCall.status === 'pending' && (
        <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" />
      )}
      {label}
    </span>
  );
}
