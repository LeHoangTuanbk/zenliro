interface ImportedPhoto {
  id: string;
  filePath: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  width: number;
  height: number;
  dataUrl: string;
  importedAt: number;
}

interface ExportPhotoRequest {
  base64: string;
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
  defaultName: string;
  /** If provided, save directly to this folder without showing a save dialog */
  destFolder?: string;
}

interface ExportPhotoResult {
  saved: boolean;
  filePath?: string;
}

interface EventPayloadMapping {
  importPhotos: ImportedPhoto[];
}

interface Window {
  electron: {
    importPhotos: () => Promise<ImportedPhoto[]>;
    exportPhoto: (req: ExportPhotoRequest) => Promise<ExportPhotoResult>;
    selectFolder: () => Promise<string | null>;
  };
}
