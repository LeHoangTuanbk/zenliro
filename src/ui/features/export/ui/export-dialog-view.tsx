import type { ExportSettings } from '../export-dialog-container';
import { BrButton } from '@/shared/ui/base';
import { LocationSection } from './sections/location-section';
import { NamingSection } from './sections/naming-section';
import { FileSettingsSection } from './sections/file-settings-section';
import { SizingSection } from './sections/sizing-section';
import { SharpeningSection } from './sections/sharpening-section';

type Props = {
  fileName: string;
  originalW: number;
  originalH: number;
  fileCount: number;
  settings: ExportSettings;
  exporting: boolean;
  done: boolean;
  set: <K extends keyof ExportSettings>(key: K, val: ExportSettings[K]) => void;
  onExport: () => void;
  onClose: () => void;
};

export function ExportDialogView({
  fileName,
  originalW,
  originalH,
  fileCount,
  settings,
  exporting,
  done,
  set,
  onExport,
  onClose,
}: Props) {
  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-[200] backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-br-panel border border-br-elevated rounded-[4px] w-[540px] max-h-[88vh] flex flex-col shadow-[0_24px_80px_rgba(0,0,0,0.85)] overflow-hidden text-[11px]">
        {/* Title bar */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-br-section border-b border-black shrink-0">
          <span className="text-[12px] font-semibold text-br-text tracking-[0.2px]">
            Export Settings
          </span>
          <BrButton className="leading-none" onClick={onClose}>✕</BrButton>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden bg-br-bg">
          <LocationSection settings={settings} set={set} />
          <div className="h-px bg-black" />
          <NamingSection settings={settings} fileName={fileName} set={set} />
          <div className="h-px bg-black" />
          <FileSettingsSection settings={settings} set={set} />
          <div className="h-px bg-black" />
          <SizingSection
            settings={settings}
            originalW={originalW}
            originalH={originalH}
            set={set}
          />
          <div className="h-px bg-black" />
          <SharpeningSection settings={settings} set={set} />
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-3.5 py-2 bg-br-section border-t border-black shrink-0 gap-2">
          <div className="flex items-center gap-2">
            <BrButton size="sm" onClick={onClose} disabled={exporting}>Cancel</BrButton>
            <BrButton size="sm" disabled={exporting}>Add to Preset</BrButton>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-br-dim whitespace-nowrap">
              {fileCount} {fileCount === 1 ? 'file' : 'files'} will be exported
            </span>
            <BrButton
              size="sm"
              variant={done ? 'success' : 'primary'}
              className="px-4 font-semibold min-w-[70px]"
              onClick={onExport}
              disabled={exporting || done}
            >
              {done ? '✓ Exported' : exporting ? 'Exporting…' : 'Export'}
            </BrButton>
          </div>
        </div>
      </div>
    </div>
  );
}
