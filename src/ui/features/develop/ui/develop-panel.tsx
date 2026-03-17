import { useState } from 'react';
import { useAdjustmentsStore } from '../model/adjustments-store';
import { AdjustmentSlider } from './adjustment-slider';
import type { Adjustments } from '../model/adjustments-store';

interface Section {
  title: string;
  sliders: Array<{
    label: string;
    name: keyof Adjustments;
    min: number;
    max: number;
    step?: number;
  }>;
}

const SECTIONS: Section[] = [
  {
    title: 'White Balance',
    sliders: [
      { label: 'Temp',       name: 'temp',       min: -100, max: 100 },
      { label: 'Tint',       name: 'tint',       min: -100, max: 100 },
    ],
  },
  {
    title: 'Light',
    sliders: [
      { label: 'Exposure',   name: 'exposure',   min: -5,   max: 5,   step: 0.05 },
      { label: 'Contrast',   name: 'contrast',   min: -100, max: 100 },
      { label: 'Highlights', name: 'highlights', min: -100, max: 100 },
      { label: 'Shadows',    name: 'shadows',    min: -100, max: 100 },
      { label: 'Whites',     name: 'whites',     min: -100, max: 100 },
      { label: 'Blacks',     name: 'blacks',     min: -100, max: 100 },
    ],
  },
  {
    title: 'Presence',
    sliders: [
      { label: 'Texture',    name: 'texture',    min: -100, max: 100 },
      { label: 'Clarity',    name: 'clarity',    min: -100, max: 100 },
      { label: 'Dehaze',     name: 'dehaze',     min: -100, max: 100 },
      { label: 'Vibrance',   name: 'vibrance',   min: -100, max: 100 },
      { label: 'Saturation', name: 'saturation', min: -100, max: 100 },
    ],
  },
];

export function DevelopPanel() {
  const { adjustments, setAdjustment, resetAdjustment, resetAll } = useAdjustmentsStore();
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const toggle = (title: string) =>
    setCollapsed((prev) => ({ ...prev, [title]: !prev[title] }));

  return (
    <div className="flex flex-col">
      {/* Panel header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-[#3a3a3a]">
        <span className="text-[11px] font-semibold text-[#f2f2f2] uppercase tracking-[0.8px]">Basic</span>
        <button
          className="border border-[#3a3a3a] text-[#929292] rounded-[2px] px-2 py-0.5 text-[10px] bg-transparent cursor-pointer hover:text-[#f2f2f2] hover:border-[#555]"
          onClick={resetAll}
          title="Reset all"
        >
          Reset
        </button>
      </div>

      {SECTIONS.map((section) => (
        <div key={section.title} className="border-b border-[#3a3a3a]">
          <button
            className="flex items-center gap-1.5 w-full px-3 py-[7px] bg-[#272727] border-none cursor-pointer hover:bg-[#2e2e2e] font-sans"
            onClick={() => toggle(section.title)}
          >
            <span className="text-[8px] text-[#505050] w-2.5">
              {collapsed[section.title] ? '▶' : '▼'}
            </span>
            <span className="text-[11px] font-semibold text-[#929292] uppercase tracking-[0.6px]">
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
                  onChange={setAdjustment}
                  onReset={resetAdjustment}
                />
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
