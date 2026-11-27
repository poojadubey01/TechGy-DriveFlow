import { createWriteStream, existsSync, mkdirSync } from 'node:fs';
import { rename, unlink } from 'node:fs/promises';
import path from 'node:path';
import type { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

import sharp from 'sharp';

/**
 * Sizes photos are served at: the longest side in pixels. Drive originals can be 10,000+ px and
 * 40 MB, far too big for a phone screen or a PDF page, so the app never gets the original.
 */
export const PHOTO_SIZES = [320, 800, 1600] as const;
export type PhotoSize = (typeof PHOTO_SIZES)[number];
/** Full-screen slides and PDF pages. */
export const DEFAULT_PHOTO_SIZE: PhotoSize = 1600;

/** The smallest served size that covers `requested` (the largest one for anything bigger). */
export function photoSize(requested?: number): PhotoSize {
  if (!requested) return DEFAULT_PHOTO_SIZE;
  return PHOTO_SIZES.find((s) => s >= requested) ?? DEFAULT_PHOTO_SIZE;
}

// One libvips thread per resize and no in-memory cache: the server is small and resized files
// are kept on disk anyway.
sharp.concurrency(1);
sharp.cache(false);

/**
 * Makes each photo size once, as a JPEG on disk, and serves that file afterwards. The cache key
 * includes the Drive file's modified time, so an edited photo gets new files.
 */
export class PhotoSizes {
  private readonly pending = new Map<string, Promise<string>>();
  private running = 0;
  private readonly waiting: (() => void)[] = [];

  constructor(
    private readonly dir: string,
    /** Resizes at the same time; each one holds a decoded photo in memory. */
    private readonly parallel = 2,
  ) {
    mkdirSync(dir, { recursive: true });
  }

  /** Path of the photo's JPEG at `size`, made from `original()` the first time it's asked for. */
  async file(key: string, size: PhotoSize, original: () => Promise<Readable>): Promise<string> {
    const target = path.join(this.dir, `${key.replace(/[^A-Za-z0-9-]/g, '')}-${size}.jpg`);
    if (existsSync(target)) return target;
    // Two requests for the same new photo share one download and resize.
    let job = this.pending.get(target);
    if (!job) {
      job = this.make(target, size, original).finally(() => this.pending.delete(target));
      this.pending.set(target, job);
    }
    return job;
  }

  private async make(target: string, size: PhotoSize, original: () => Promise<Readable>) {
    await this.slot();
    const temp = `${target}.${process.pid}.${Date.now()}.tmp`;
    try {
      const resize = sharp({ limitInputPixels: 400_000_000 })
        .rotate() // apply the camera's orientation flag
        .resize(size, size, { fit: 'inside', withoutEnlargement: true })
        .flatten({ background: '#ffffff' }) // transparent PNGs get a white background, not black
        .jpeg({ quality: 80, mozjpeg: true });
      await pipeline(await original(), resize, createWriteStream(temp));
      // Rename last, so a half-written file is never served.
      await rename(temp, target);
      return target;
    } catch (e) {
      await unlink(temp).catch(() => undefined);
      throw e;
    } finally {
      this.release();
    }
  }

  private async slot() {
    if (this.running < this.parallel) {
      this.running++;
      return;
    }
    await new Promise<void>((resolve) => this.waiting.push(resolve));
  }

  private release() {
    const next = this.waiting.shift();
    if (next) next();
    else this.running--;
  }
}
