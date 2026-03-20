import { useState } from 'react';
import { useAdjustmentsStore } from '../store/adjustments-store';
import { AdjustmentSlider } from './adjustment-slider';
import { SECTIONS } from '../const/section';
import { ToneCurvePanel } from '@/features/develop/edit/tone-curve';
import { ColorMixerPanel } from '@/features/develop/edit/color-mixer';
import { ColorGradingPanel } from '@/features/develop/edit/color-grading';
import { EffectsPanel } from '@/features/develop/edit/effects';
import { BrButton } from '@/shared/ui/base';

type ExtraSection = { title: string; node: React.ReactNode };

const EXTRA_SECTIONS: ExtraSection[] = [
  { title: 'Tone Curve', node: <ToneCurvePanel /> },
  { title: 'Color Mixer', node: <ColorMixerPanel /> },
  { title: 'Color Grading', node: <ColorGradingPanel /> },
  { title: 'Effects', node: <EffectsPanel /> },
];

export function EditPanel() {
  const { adjustments, setAdjustment, resetAdjustment, resetAll } = useAdjustmentsStore();
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const toggle = (title: string) => setCollapsed((prev) => ({ ...prev, [title]: !prev[title] }));

  return (
    <div className="flex flex-col">
      {/* Panel header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-br-elevated">
        <span className="text-[11px] font-semibold text-br-text uppercase tracking-[0.8px]">
          Basic
        </span>
        <BrButton onClick={resetAll} title="Reset all">
          Reset
        </BrButton>
      </div>

      {SECTIONS.map((section) => (
        <div key={section.title} className="border-b border-br-elevated">
          <button
            className="flex items-center gap-1.5 w-full px-3 py-[7px] bg-br-section border-none cursor-pointer hover:bg-br-section-hover font-sans"
            onClick={() => toggle(section.title)}
          >
            <span className="text-[8px] text-br-dim w-2.5">
              {collapsed[section.title] ? '▶' : '▼'}
            </span>
            <span className="text-[11px] font-semibold text-br-muted uppercase tracking-[0.6px]">
              {section.title}
            </span>
          </button>

          {!collapsed[section.title] && (
            <div className="px-3 py-2 flex flex-col gap-0.5">
              {section.sliders.map((s) => (
                <AdjustmentSlider
                  key={s.name}
                  label={s.label}
                  name={s.name}
                  value={adjustments[s.name]}
                  min={s.min}
                  max={s.max}
                  step={s.step}
                  gradient={s.gradient}
                  onChange={setAdjustment}
                  onReset={resetAdjustment}
                />
              ))}
            </div>
          )}
        </div>
      ))}

      {EXTRA_SECTIONS.map((section) => (
        <div key={section.title} className="border-b border-br-elevated">
          <button
            className="flex items-center gap-1.5 w-full px-3 py-[7px] bg-br-section border-none cursor-pointer hover:bg-br-section-hover font-sans"
            onClick={() => toggle(section.title)}
          >
            <span className="text-[8px] text-br-dim w-2.5">
              {collapsed[section.title] ? '▶' : '▼'}
            </span>
            <span className="text-[11px] font-semibold text-br-muted uppercase tracking-[0.6px]">
              {section.title}
            </span>
          </button>

          {!collapsed[section.title] && <div className="bg-br-panel">{section.node}</div>}
        </div>
      ))}
    </div>
  );
}
