import { ActiveTool } from '@features/develop/const';

// Lightroom-style SVG icons
const icons: Record<ActiveTool, React.ReactNode> = {
  edit: (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
    >
      <line x1="4" y1="6" x2="20" y2="6" />
      <line x1="8" y1="12" x2="20" y2="12" />
      <line x1="4" y1="18" x2="20" y2="18" />
      <circle cx="6" cy="6" r="2" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="2" fill="currentColor" stroke="none" />
      <circle cx="8" cy="18" r="2" fill="currentColor" stroke="none" />
    </svg>
  ),
  heal: (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
    >
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="3" />
      <line x1="12" y1="4" x2="12" y2="9" />
      <line x1="12" y1="15" x2="12" y2="20" />
    </svg>
  ),
  crop: (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
    >
      <polyline points="6 2 6 18 22 18" />
      <polyline points="2 6 18 6 18 22" />
    </svg>
  ),
};

const labels: Record<ActiveTool, string> = {
  edit: 'Edit',
  heal: 'Heal',
  crop: 'Crop & Rotate',
};

type ToolStripProps = {
  activeTool: ActiveTool;
  onSelect: (tool: ActiveTool) => void;
};

export function ToolStrip({ activeTool, onSelect }: ToolStripProps) {
  const tools = Object.values(ActiveTool);

  return (
    <div className="flex items-center justify-center gap-1 px-2 py-2 bg-[#1e1e1e] border-b border-black">
      {tools.map((tool) => (
        <div key={tool} className="relative group">
          <button
            onClick={() => onSelect(tool)}
            onMouseDown={(e) => e.currentTarget.blur()}
            className={`flex items-center justify-center w-10 h-8 rounded-[3px] cursor-pointer transition-colors border ${
              activeTool === tool
                ? 'bg-[#2a3d50] text-br-accent border-[#2d4f6a]'
                : 'bg-transparent text-br-muted border-transparent hover:text-br-text hover:bg-br-hover'
            }`}
          >
            {icons[tool]}
          </button>

          {/* Tooltip */}
          <div className="pointer-events-none absolute top-full left-1/2 -translate-x-1/2 mt-1.5 px-2 py-0.5 bg-[#111] border border-[#333] text-br-text text-[10px] tracking-wide rounded-[3px] whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity delay-300 z-50">
            {labels[tool]}
          </div>
        </div>
      ))}
    </div>
  );
}
