import { Readable } from 'node:stream';
import type { ReadableStream as WebReadableStream } from 'node:stream/web';

import { AppError } from '../../lib/errors.js';
import type { DriveFolderInfo, DriveImage, DriveSource } from './types.js';

const API = 'https://www.googleapis.com/drive/v3';
const FOLDER = 'application/vnd.google-apps.folder';

type FilesPage = {
  nextPageToken?: string;
  files?: {
    id: string;
    name: string;
    mimeType: string;
    description?: string;
    modifiedTime?: string;
    imageMediaMetadata?: { width?: number; height?: number };
  }[];
};

const quote = (s: string) => `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;

/** Google Drive v3 over REST with a (refreshed) access token. Read-only scope. */
export class GoogleDriveSource implements DriveSource {
  constructor(private readonly accessToken: () => Promise<string>) {}

  private async get(url: string): Promise<Response> {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${await this.accessToken()}` } });
    if (res.status === 401 || res.status === 403) {
      throw new AppError(409, 'drive_reconnect', 'DriveFlow lost access to your Google Drive. Please connect it again.');
    }
    if (res.status === 404) throw new AppError(404, 'not_found', 'That Drive file or folder was not found.');
    if (!res.ok) throw new AppError(502, 'drive_unavailable', 'Google Drive didn’t respond. Please try again in a moment.');
    return res;
  }

  private async list(q: string, orderBy: string): Promise<NonNullable<FilesPage['files']>> {
    const out: NonNullable<FilesPage['files']> = [];
    let pageToken: string | undefined;
    do {
      const params = new URLSearchParams({
        q,
        orderBy,
        pageSize: '1000',
        fields: 'nextPageToken,files(id,name,mimeType,description,modifiedTime,imageMediaMetadata(width,height))',
        supportsAllDrives: 'true',
        includeItemsFromAllDrives: 'true',
        ...(pageToken ? { pageToken } : {}),
      });
      const page = (await (await this.get(`${API}/files?${params}`)).json()) as FilesPage;
      out.push(...(page.files ?? []));
      pageToken = page.nextPageToken;
    } while (pageToken && out.length < 20_000);
    return out;
  }

  async listFolders(parentId: string): Promise<DriveFolderInfo[]> {
    const files = await this.list(`${quote(parentId)} in parents and mimeType = '${FOLDER}' and trashed = false`, 'name');
    return files.map((f) => ({ id: f.id, name: f.name, description: f.description ?? '', modifiedTime: f.modifiedTime ?? null }));
  }

  async listImages(folderId: string): Promise<DriveImage[]> {
    const files = await this.list(`${quote(folderId)} in parents and mimeType contains 'image/' and trashed = false`, 'name');
    return files.map((f) => ({
      id: f.id,
      name: f.name,
      mimeType: f.mimeType,
      description: f.description ?? '',
      width: f.imageMediaMetadata?.width ?? null,
      height: f.imageMediaMetadata?.height ?? null,
      modifiedTime: f.modifiedTime ?? null,
    }));
  }

  async download(fileId: string) {
    const res = await this.get(`${API}/files/${encodeURIComponent(fileId)}?alt=media&supportsAllDrives=true`);
    if (!res.body) throw new AppError(502, 'drive_unavailable', 'Google Drive didn’t send the photo.');
    const length = Number(res.headers.get('content-length')) || undefined;
    return {
      stream: Readable.fromWeb(res.body as unknown as WebReadableStream),
      contentType: res.headers.get('content-type') ?? 'application/octet-stream',
      length,
    };
  }
}
