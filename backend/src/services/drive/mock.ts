import { createReadStream, existsSync, statSync } from 'node:fs';
import path from 'node:path';

import { notFound } from '../../lib/errors.js';
import type { DriveFolderInfo, DriveImage, DriveSource } from './types.js';

type MockFolder = { id: string; name: string; description: string; parent: string };
type MockFile = { id: string; folder: string; name: string; description: string };

/** The app's sample clients (same names, descriptions and photos as frontend/src/data/clients.ts). */
const CLIENTS: { key: string; name: string; meta: string; files: string[] }[] = [
  {
    key: 'highrize',
    name: 'Highrize Villas',
    meta: 'Luxury villas',
    files: ['highrize.jpg', 'highrize-living.jpg', 'highrize-dining.jpg', 'highrize-suite.jpg', 'highrize-kitchen.jpg', 'villas-night.jpg', 'vijetha-pool.jpg'],
  },
  {
    key: 'otherside',
    name: 'Other Side Villas',
    meta: 'Gated community',
    files: ['otherside.jpg', 'otherside-night.jpg', 'villas-night.jpg', 'highrize-living.jpg', 'highrize-dining.jpg', 'vijetha-pool.jpg', 'highrize-suite.jpg'],
  },
  {
    key: 'elysium',
    name: 'Reliance Elysium',
    meta: 'Residential towers',
    files: ['elysium.jpg', 'elysium-lobby.jpg', 'highrize-kitchen.jpg', 'highrize-living.jpg', 'highrize-suite.jpg', 'vijetha-pool.jpg', 'highrize-dining.jpg'],
  },
  {
    key: 'vijetha',
    name: 'Vijetha Vaibhogam',
    meta: 'Villa township',
    files: ['vijetha.jpg', 'vijetha-pool.jpg', 'villas-night.jpg', 'otherside.jpg', 'highrize-living.jpg', 'highrize-suite.jpg', 'highrize-dining.jpg'],
  },
];

/** Building shots whose file names don't say so; Drive users can do the same with a file description. */
const EXTERIOR_COVERS = new Set(['highrize.jpg', 'otherside.jpg', 'elysium.jpg', 'vijetha.jpg']);

/**
 * Development stand-in for Google Drive: a "Projects" folder with one sub-folder per sample client,
 * serving the app's bundled sample photos. Lets the whole Drive flow run without Google keys.
 */
export class MockDriveSource implements DriveSource {
  private readonly folders: MockFolder[] = [
    { id: 'mock-projects', name: 'Projects', description: 'One folder per client', parent: 'root' },
    { id: 'mock-marketing', name: 'Marketing', description: '', parent: 'root' },
    { id: 'mock-archive', name: 'Archive 2025', description: '', parent: 'root' },
  ];
  private readonly files: MockFile[] = [];

  constructor(private readonly photosDir: string) {
    for (const c of CLIENTS) {
      const folder = `mock-${c.key}`;
      this.folders.push({ id: folder, name: c.name, description: c.meta, parent: 'mock-projects' });
      c.files.forEach((name) => this.files.push({ id: `${folder}--${name}`, folder, name, description: EXTERIOR_COVERS.has(name) ? 'exterior' : '' }));
    }
  }

  /** Test helper: drop a new photo into a client folder (as if someone uploaded it to Drive). */
  addImage(folderId: string, name: string, copyOf = 'highrize-living.jpg') {
    const id = `${folderId}--${name}`;
    this.files.push({ id, folder: folderId, name, description: `copy:${copyOf}` });
    return id;
  }

  /** Test helper: remove a photo (as if it was deleted in Drive). */
  removeImage(fileId: string) {
    const i = this.files.findIndex((f) => f.id === fileId);
    if (i >= 0) this.files.splice(i, 1);
  }

  async listFolders(parentId: string): Promise<DriveFolderInfo[]> {
    return this.folders
      .filter((f) => f.parent === parentId)
      .map((f) => ({ id: f.id, name: f.name, description: f.description, modifiedTime: new Date().toISOString() }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  async listImages(folderId: string): Promise<DriveImage[]> {
    return this.files
      .filter((f) => f.folder === folderId)
      .map((f) => ({
        id: f.id,
        name: f.name,
        mimeType: 'image/jpeg',
        description: f.description.startsWith('copy:') ? '' : f.description,
        width: 1600,
        height: 1067,
        modifiedTime: null,
      }));
    // Kept in the app's gallery order (cover first), so synced sample decks match the app exactly.
  }

  async download(fileId: string) {
    const file = this.files.find((f) => f.id === fileId);
    if (!file) throw notFound('That photo');
    const source = file.description.startsWith('copy:') ? file.description.slice(5) : file.name;
    const full = path.join(this.photosDir, path.basename(source));
    if (!existsSync(full)) throw notFound('That photo');
    return { stream: createReadStream(full), contentType: 'image/jpeg', length: statSync(full).size };
  }
}
