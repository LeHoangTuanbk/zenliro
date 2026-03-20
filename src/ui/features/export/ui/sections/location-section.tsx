import { useState } from 'react';
import { SectionHeader, FieldRow, inputCls } from '../export-primitives';
import type { ExportSettings } from '../../export-dialog-container';

type Props = {
  settings: ExportSettings;
  set: <K extends keyof ExportSettings>(key: K, val: ExportSettings[K]) => void;
};

export function LocationSection({ settings, set }: Props) {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <>
      <SectionHeader
        label="Export Location"
        collapsed={collapsed}
        onToggle={() => setCollapsed((c) => !c)}
      />
      {!collapsed && (
        <div className="py-1">
          <FieldRow label="Export To:">
            <span className="text-[#8a8a8a] text-[11px]">Specific Folder</span>
          </FieldRow>
          <FieldRow label="Folder:">
            <input
              className={`${inputCls} flex-1 min-w-0`}
              value={settings.exportFolder}
              onChange={(e) => set('exportFolder', e.target.value)}
              placeholder="~/Pictures"
            />
            <button
              className="bg-transparent border border-br-elevated rounded-[2px] text-br-muted text-[11px] px-4 h-[22px] cursor-pointer font-sans hover:border-br-mark hover:text-br-text flex items-center justify-center shrink-0"
              onClick={async () => {
                const folder = await window.electron.selectFolder();
                if (folder) set('exportFolder', folder);
              }}
            >
              Browse
            </button>
          </FieldRow>
          <FieldRow label="Put in Subfolder:">
            <input
              type="checkbox"
              className="w-[13px] h-[13px] accent-br-accent cursor-pointer shrink-0"
              checked={settings.putInSubfolder}
              onChange={(e) => set('putInSubfolder', e.target.checked)}
            />
            <input
              className={`${inputCls} flex-1 min-w-0`}
              disabled={!settings.putInSubfolder}
              value={settings.subfolderName}
              onChange={(e) => set('subfolderName', e.target.value)}
              placeholder="subfolder name"
            />
          </FieldRow>
        </div>
      )}
    </>
  );
}
