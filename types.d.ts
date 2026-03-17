interface ImportedPhoto {
  id: string;
  filePath: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  width: number;
  height: number;
  thumbnailDataUrl: string;
  importedAt: number;
}

interface EventPayloadMapping {
  importPhotos: ImportedPhoto[];
}

interface Window {
  electronAPI: {
    importPhotos: () => Promise<ImportedPhoto[]>;
  };
}
