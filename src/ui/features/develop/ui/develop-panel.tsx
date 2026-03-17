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
      { label: 'Temp',        name: 'temp',        min: -100, max: 100 },
      { label: 'Tint',        name: 'tint',        min: -100, max: 100 },
    ],
  },
  {
    title: 'Light',
    sliders: [
      { label: 'Exposure',    name: 'exposure',    min: -5,   max: 5,   step: 0.05 },
      { label: 'Contrast',    name: 'contrast',    min: -100, max: 100 },
      { label: 'Highlights',  name: 'highlights',  min: -100, max: 100 },
      { label: 'Shadows',     name: 'shadows',     min: -100, max: 100 },
      { label: 'Whites',      name: 'whites',      min: -100, max: 100 },
      { label: 'Blacks',      name: 'blacks',      min: -100, max: 100 },
    ],
  },
  {
    title: 'Presence',
    sliders: [
      { label: 'Texture',     name: 'texture',     min: -100, max: 100 },
      { label: 'Clarity',     name: 'clarity',     min: -100, max: 100 },
      { label: 'Dehaze',      name: 'dehaze',      min: -100, max: 100 },
      { label: 'Vibrance',    name: 'vibrance',    min: -100, max: 100 },
      { label: 'Saturation',  name: 'saturation',  min: -100, max: 100 },
    ],
  },
];

export function DevelopPanel() {
  const { adjustments, setAdjustment, resetAdjustment, resetAll } = useAdjustmentsStore();
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const toggle = (title: string) =>
    setCollapsed((prev) => ({ ...prev, [title]: !prev[title] }));

  return (
    <div className="develop-panel">
      <div className="panel-header">
        <span className="panel-title">Basic</span>
        <button className="reset-all-btn" onClick={resetAll} title="Reset all">
          Reset
        </button>
      </div>

      {SECTIONS.map((section) => (
        <div key={section.title} className="panel-section">
          <button
            className="section-header"
            onClick={() => toggle(section.title)}
          >
            <span className="section-arrow">{collapsed[section.title] ? '▶' : '▼'}</span>
            <span className="section-title">{section.title}</span>
          </button>

          {!collapsed[section.title] && (
            <div className="section-body">
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
