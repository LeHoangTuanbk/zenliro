import type { ActiveTool } from '../../heal/model/types';

// Lightroom-style SVG icons
const icons: Record<ActiveTool, JSX.Element> = {
  edit: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <line x1="4" y1="6"  x2="20" y2="6"  />
      <line x1="8" y1="12" x2="20" y2="12" />
      <line x1="4" y1="18" x2="20" y2="18" />
      <circle cx="6"  cy="6"  r="2" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="2" fill="currentColor" stroke="none" />
      <circle cx="8"  cy="18" r="2" fill="currentColor" stroke="none" />
    </svg>
  ),
  heal: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="3" />
      <line x1="12" y1="4"  x2="12" y2="9"  />
      <line x1="12" y1="15" x2="12" y2="20" />
    </svg>
  ),
  crop: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <polyline points="6 2 6 18 22 18" />
      <polyline points="2 6 18 6 18 22" />
    </svg>
  ),
};

const labels: Record<ActiveTool, string> = {
  edit: 'Edit',
  heal: 'Heal',
  crop: 'Crop',
};

interface ToolStripProps {
  activeTool: ActiveTool;
  onSelect: (tool: ActiveTool) => void;
}

export function ToolStrip({ activeTool, onSelect }: ToolStripProps) {
  const tools: ActiveTool[] = ['edit', 'heal', 'crop'];

  return (
    <div className="flex items-center justify-center gap-1 px-2 py-2 bg-[#1e1e1e] border-b border-black">
      {tools.map((tool) => (
        <button
          key={tool}
          title={labels[tool]}
          onClick={() => onSelect(tool)}
          className={`flex flex-col items-center gap-0.5 w-14 py-1.5 rounded-[3px] cursor-pointer transition-colors border ${
            activeTool === tool
              ? 'bg-[#2a3d50] text-[#4d9fec] border-[#2d4f6a]'
              : 'bg-transparent text-[#666] border-transparent hover:text-[#929292] hover:bg-[#2a2a2a]'
          }`}
        >
          {icons[tool]}
          <span className="text-[9px] tracking-wide">{labels[tool]}</span>
        </button>
      ))}
    </div>
  );
}
