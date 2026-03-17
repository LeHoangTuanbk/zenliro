export interface Photo {
  id: string;
  filePath: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  width: number;
  height: number;
  thumbnailDataUrl: string;
  importedAt: number;
  rating: number;
  flagged: boolean;
  rejected: boolean;
}
