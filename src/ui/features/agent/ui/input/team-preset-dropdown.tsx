import { useAgentStore } from '../../store/agent-store';

type TeamPresetDropdownProps = {
  open: boolean;
  onToggle: () => void;
  onPicked: () => void;
};

type TeamPreset = { n: number; label: string; desc: string; enabled: boolean };

const TEAM_PRESETS: TeamPreset[] = [
  { n: 1, label: 'Solo', desc: 'Single editor', enabled: true },
  { n: 2, label: 'Editor + Reviewer', desc: 'Reviewer checks quality', enabled: true },
  { n: 3, label: 'Art Studio', desc: '3 agents — soon', enabled: false },
  { n: 5, label: 'Full Panel', desc: '5 agents — soon', enabled: false },
];

export function TeamPresetDropdown({ open, onToggle, onPicked }: TeamPresetDropdownProps) {
  const agentCount = useAgentStore((s) => s.agentCount);
  return (
    <div className="relative">
      <button
        onClick={onToggle}
        className="flex items-center gap-0.5 px-1 py-0.5 rounded text-[10px] font-medium text-[#f5c542] hover:text-[#ffd966] transition-colors"
        title="Parallel agents"
      >
        <svg width="10" height="12" viewBox="0 0 10 12" fill="none">
          <path d="M6 0.5L1 7h4l-1 4.5L9 5H5.5L6 0.5z" fill="currentColor" />
        </svg>
        <span>{agentCount}x</span>
      </button>
      {open && <TeamPresetMenu onPicked={onPicked} />}
    </div>
  );
}

function TeamPresetMenu({ onPicked }: { onPicked: () => void }) {
  const agentCount = useAgentStore((s) => s.agentCount);
  const setAgentCount = useAgentStore((s) => s.setAgentCount);
  return (
    <div className="absolute bottom-full left-0 mb-1 w-[200px] bg-[#2a2a2a] border border-[#444] rounded-[6px] shadow-xl overflow-hidden z-50">
      <div className="px-3 py-1.5 text-[9px] text-[#666] uppercase tracking-wider border-b border-[#333]">
        Team preset
      </div>
      {TEAM_PRESETS.map(({ n, label, desc, enabled }) => (
        <button
          key={n}
          onClick={() => {
            if (!enabled) return;
            setAgentCount(n);
            onPicked();
          }}
          disabled={!enabled}
          title={enabled ? desc : 'Coming soon'}
          className={`w-full text-left px-3 py-1.5 text-[11px] transition-colors ${
            n === agentCount
              ? 'text-white bg-[#333]'
              : !enabled
                ? 'text-[#444] cursor-not-allowed'
                : 'text-[#aaa] hover:bg-[#333] hover:text-white'
          }`}
        >
          <div className="flex items-center gap-2">
            <span className="font-medium">{n}x</span>
            <span>{label}</span>
          </div>
          <div className="text-[9px] text-[#666] mt-0.5">{desc}</div>
        </button>
      ))}
    </div>
  );
}
