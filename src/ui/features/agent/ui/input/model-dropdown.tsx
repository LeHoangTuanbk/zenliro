import { useAgentStore } from '../../store/agent-store';
import type { AgentModel, AgentProvider } from '../../store/agent-store';

type ModelDropdownProps = {
  open: boolean;
  onToggle: () => void;
  onSelect: () => void;
};

export function ModelDropdown({ open, onToggle, onSelect }: ModelDropdownProps) {
  const modelId = useAgentStore((s) => s.modelId);
  const models = useAgentStore((s) => s.models);
  const currentModel = models.find((m) => m.id === modelId) ?? models[0];

  return (
    <div className="relative">
      <button
        onClick={onToggle}
        className="flex items-center gap-1 text-[10px] text-[#999] hover:text-[#ccc] transition-colors px-1 py-0.5"
      >
        <span>{currentModel?.label ?? modelId}</span>
        <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
          <path d="M2 3l2 2 2-2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
      </button>
      {open && <ModelMenu onPicked={onSelect} />}
    </div>
  );
}

function ModelMenu({ onPicked }: { onPicked: () => void }) {
  const provider = useAgentStore((s) => s.provider);
  const models = useAgentStore((s) => s.models);
  const hasMessages = useAgentStore((s) => s.messages.length > 0);
  const claudeModels = models.filter((m) => m.provider === 'claude');
  const codexModels = models.filter((m) => m.provider === 'codex');

  return (
    <div className="absolute bottom-full left-0 mb-1 w-[160px] bg-[#2a2a2a] border border-[#444] rounded-[6px] shadow-xl overflow-hidden z-50 max-h-[300px] overflow-y-auto">
      <ModelGroup
        title="Claude"
        models={claudeModels}
        lockedReason={hasMessages && provider !== 'claude'}
        onPicked={onPicked}
      />
      {codexModels.length > 0 && (
        <ModelGroup
          title="Codex"
          models={codexModels}
          lockedReason={hasMessages && provider !== 'codex'}
          onPicked={onPicked}
          divider
        />
      )}
    </div>
  );
}

type ModelGroupProps = {
  title: string;
  models: AgentModel[];
  lockedReason: boolean;
  onPicked: () => void;
  divider?: boolean;
};

function ModelGroup({ title, models, lockedReason, onPicked, divider }: ModelGroupProps) {
  const modelId = useAgentStore((s) => s.modelId);
  const setModelId = useAgentStore((s) => s.setModelId);
  return (
    <>
      <div
        className={`px-2.5 py-1 text-[9px] text-[#555] uppercase tracking-wider border-b border-[#333] ${divider ? 'border-t' : ''}`}
      >
        {title}
      </div>
      {models.map((m) => (
        <button
          key={m.id}
          disabled={lockedReason}
          onClick={() => {
            setModelId(m.id, m.provider as AgentProvider);
            onPicked();
          }}
          className={`w-full text-left px-2.5 py-1 text-[11px] ${
            lockedReason
              ? 'text-[#444] cursor-not-allowed'
              : m.id === modelId
                ? 'text-white bg-[#333]'
                : 'text-[#aaa] hover:bg-[#333]'
          }`}
        >
          {m.label}
        </button>
      ))}
    </>
  );
}
