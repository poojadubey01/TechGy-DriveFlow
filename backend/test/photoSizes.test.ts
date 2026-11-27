import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Readable } from 'node:stream';

import sharp from 'sharp';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AppError } from '../src/lib/errors.js';
import { PhotoSizes, photoSize } from '../src/services/photoSizes.js';

let dir: string;
let jpeg: Buffer;
beforeEach(async () => {
  dir = mkdtempSync(path.join(tmpdir(), 'photo-sizes-'));
  jpeg = await sharp({ create: { width: 3000, height: 2000, channels: 3, background: '#3355ff' } }).jpeg().toBuffer();
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe('photo sizes', () => {
  it('rounds a requested width up to a served size', () => {
    expect([photoSize(), photoSize(50), photoSize(320), photoSize(321), photoSize(1200), photoSize(5000)]).toEqual([1600, 320, 320, 800, 1600, 1600]);
  });

  it('makes every size from one download, even for requests at the same time', async () => {
    const sizes = new PhotoSizes(dir);
    const original = vi.fn(async () => Readable.from([jpeg]));
    const [small, large] = await Promise.all([sizes.file('p1-0', 320, original), sizes.file('p1-0', 1600, original)]);
    expect(original).toHaveBeenCalledTimes(1);
    expect((await sharp(small).metadata()).width).toBe(320);
    expect((await sharp(large).metadata()).width).toBe(1600);
    await sizes.file('p1-0', 800, original);
    expect(original).toHaveBeenCalledTimes(1);
  });

  it('passes Drive errors on and leaves no half-written files', async () => {
    const sizes = new PhotoSizes(dir);
    const gone = new AppError(409, 'drive_reconnect', 'Please connect your Google Drive again.');
    await expect(sizes.file('p2-0', 1600, async () => Promise.reject(gone))).rejects.toBe(gone);
    await expect(sizes.file('p3-0', 1600, async () => Readable.from([Buffer.from('not a photo')]))).rejects.toThrow();
    expect(readdirSync(dir)).toEqual([]);
    // A later try can still succeed.
    expect(await sizes.file('p2-0', 320, async () => Readable.from([jpeg]))).toMatch(/p2-0-320\.jpg$/);
  });

  it('prepares photos in the background', async () => {
    const errors: string[] = [];
    const sizes = new PhotoSizes(dir, 2, (key) => errors.push(key));
    sizes.warm('p4-0', async () => Readable.from([jpeg]));
    sizes.warm('p5-0', async () => Readable.from([Buffer.from('broken')]));
    await sizes.settled();
    expect(readdirSync(dir).sort()).toEqual(['p4-0-1600.jpg', 'p4-0-320.jpg', 'p4-0-800.jpg']);
    expect(errors).toEqual(['p5-0']);
  });
});
