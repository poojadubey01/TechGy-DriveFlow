import type { Readable } from 'node:stream';

export type DriveFolderInfo = { id: string; name: string; description: string; modifiedTime: string | null };

export type DriveImage = {
  id: string;
  name: string;
  mimeType: string;
  description: string;
  width: number | null;
  height: number | null;
  modifiedTime: string | null;
};

/** Read-only view of one person's Google Drive (real or the development stand-in). */
export interface DriveSource {
  /** Folders directly inside `parentId` ('root' = top of My Drive). */
  listFolders(parentId: string): Promise<DriveFolderInfo[]>;
  /** Image files directly inside a folder, sorted by name. */
  listImages(folderId: string): Promise<DriveImage[]>;
  /** The image's bytes. */
  download(fileId: string): Promise<{ stream: Readable; contentType: string; length?: number }>;
}
