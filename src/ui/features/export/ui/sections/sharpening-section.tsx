import { useState } from 'react';
import { SectionHeader, FieldRow, selectCls } from '../export-primitives';
import type { ExportSettings } from '../../export-dialog-container';

type Props = {
  settings: ExportSettings;
  set: <K extends keyof ExportSettings>(key: K, val: ExportSettings[K]) => void;
};

export function SharpeningSection({ settings, set }: Props) {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <>
      <SectionHeader
        label="Output Sharpening"
        collapsed={collapsed}
        onToggle={() => setCollapsed((c) => !c)}
        hasActive={settings.sharpen}
      />
      {!collapsed && (
        <div className="py-1">
          <FieldRow label="Sharpen For:">
            <input
              type="checkbox"
              className="w-[13px] h-[13px] cursor-pointer shrink-0"
              style={{ accentColor: 'var(--color-br-accent)' }}
              checked={settings.sharpen}
              onChange={(e) => set('sharpen', e.target.checked)}
            />
            <select
              className={selectCls}
              disabled={!settings.sharpen}
              value={settings.sharpenFor}
              onChange={(e) => set('sharpenFor', e.target.value as ExportSettings['sharpenFor'])}
            >
              <option value="screen">Screen</option>
              <option value="matte">Matte Paper</option>
              <option value="glossy">Glossy Paper</option>
            </select>
          </FieldRow>
          {settings.sharpen && (
            <FieldRow label="Amount:">
              <select
                className={selectCls}
                value={settings.sharpenAmount}
                onChange={(e) =>
                  set('sharpenAmount', e.target.value as ExportSettings['sharpenAmount'])
                }
              >
                <option value="low">Low</option>
                <option value="standard">Standard</option>
                <option value="high">High</option>
              </select>
            </FieldRow>
          )}
        </div>
      )}
    </>
  );
}
