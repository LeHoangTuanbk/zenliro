import { useAgentStore } from '../store/agent-store';

export function AgentToggleButton() {
  const isOpen = useAgentStore((s) => s.isOpen);
  const toggle = useAgentStore((s) => s.toggle);

  if (isOpen) return null;

  return (
    <button
      onClick={toggle}
      className="absolute bottom-3 left-3 z-20 w-9 h-9 rounded-full bg-br-accent/20 border border-br-accent/40 text-br-accent flex items-center justify-center hover:bg-br-accent/30 transition-colors shadow-lg cursor-pointer"
      title="AI Agent"
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path
          d="M8 1.5a6.5 6.5 0 100 13 6.5 6.5 0 000-13zM5.5 6.5a1 1 0 112 0 1 1 0 01-2 0zm3 0a1 1 0 112 0 1 1 0 01-2 0zM5 10a3 3 0 016 0H5z"
          fill="currentColor"
        />
      </svg>
    </button>
  );
}
