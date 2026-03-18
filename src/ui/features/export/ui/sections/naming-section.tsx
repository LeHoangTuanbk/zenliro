import { useState } from 'react';
import { SectionHeader, FieldRow, inputCls, selectCls } from '../export-primitives';
import type { ExportSettings } from '../../export-dialog-container';

type Props = {
  settings: ExportSettings;
  fileName: string;
  set: <K extends keyof ExportSettings>(key: K, val: ExportSettings[K]) => void;
};

function deriveExampleName(
  template: string,
  customText: string,
  startNum: number,
  fileName: string,
) {
  const base = fileName.replace(/\.[^.]+$/, '');
  if (template === 'filename') return `${base}.jpg`;
  if (template === 'custom') return `${customText || 'photo'}.jpg`;
  return `${base}_${customText || 'edit'}_${startNum}.jpg`;
}

export function NamingSection({ settings, fileName, set }: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const exampleName = deriveExampleName(
    settings.namingTemplate,
    settings.customText,
    settings.startNumber,
    fileName,
  );
  return (
    <>
      <SectionHeader
        label="File Naming"
        collapsed={collapsed}
        onToggle={() => setCollapsed((c) => !c)}
      />
      {!collapsed && (
        <div className="py-1">
          <FieldRow label="Template:">
            <select
              className={`${selectCls} flex-1`}
              value={settings.namingTemplate}
              onChange={(e) => set('namingTemplate', e.target.value)}
            >
              <option value="filename">Filename</option>
              <option value="filename-sequence">Filename - Sequence</option>
              <option value="custom">Custom Name - Sequence</option>
              <option value="date">Date - Filename</option>
            </select>
          </FieldRow>
          <FieldRow label="Custom Text:">
            <input
              className={`${inputCls} flex-1 min-w-0`}
              value={settings.customText}
              onChange={(e) => set('customText', e.target.value)}
              placeholder="edit"
            />
          </FieldRow>
          <FieldRow label="Start Number:">
            <input
              type="number"
              className={`${inputCls} w-[60px] text-right`}
              value={settings.startNumber}
              min={1}
              onChange={(e) => set('startNumber', Number(e.target.value))}
            />
          </FieldRow>
          <FieldRow label="Example:">
            <span className="text-[#6a9fcc] text-[10px] italic">{exampleName}</span>
          </FieldRow>
        </div>
      )}
    </>
  );
}
