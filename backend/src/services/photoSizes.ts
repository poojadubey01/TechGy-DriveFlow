import { existsSync, mkdirSync } from 'node:fs';
import { rename, unlink } from 'node:fs/promises';
import path from 'node:path';
import type { Readable } from 'node:stream';

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

type Original = () => Promise<Readable>;

/** Resized files are per photo and Drive version: an edited photo gets new ones. */
export const photoKey = (photo: { id: string; driveModifiedAt: Date | null }) => `${photo.id}-${photo.driveModifiedAt?.getTime() ?? 0}`;

/**
 * Makes every size of a photo from one download of the original, as JPEGs on disk, and serves
 * those files afterwards. Callers build the key from the photo id and the Drive file's modified
 * time, so an edited photo gets new files.
 */
export class PhotoSizes {
  private readonly pending = new Map<string, Promise<void>>();
  private running = 0;
  private readonly waiting: (() => void)[] = [];
  /** Photos to prepare in the background, one at a time. */
  private readonly warmQueue: { key: string; original: Original }[] = [];
  private warming = false;

  constructor(
    private readonly dir: string,
    /** Resizes at the same time; each one holds a photo in memory. Warm-up uses at most one. */
    private readonly parallel = 2,
    private readonly onWarmError: (key: string, error: unknown) => void = () => undefined,
  ) {
    mkdirSync(dir, { recursive: true });
  }

  /** Path of the photo's JPEG at `size`, made (with the other sizes) the first time it's asked for. */
  async file(key: string, size: PhotoSize, original: Original): Promise<string> {
    const target = this.path(key, size);
    if (!existsSync(target)) await this.makeAll(key, original);
    return target;
  }

  /** Prepares the photo's sizes in the background, so its first view is quick. */
  warm(key: string, original: Original) {
    if (this.ready(key) || this.warmQueue.some((w) => w.key === key)) return;
    this.warmQueue.push({ key, original });
    void this.drainWarmQueue();
  }

  /** Resolves once the background queue and every resize in progress are done (for tests). */
  async settled() {
    while (this.warming || this.warmQueue.length || this.pending.size) {
      await Promise.allSettled([...this.pending.values()]);
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
  }

  private ready(key: string) {
    return PHOTO_SIZES.every((s) => existsSync(this.path(key, s)));
  }

  private path(key: string, size: PhotoSize) {
    return path.join(this.dir, `${key.replace(/[^A-Za-z0-9-]/g, '')}-${size}.jpg`);
  }

  private async drainWarmQueue() {
    if (this.warming) return;
    this.warming = true;
    try {
      for (let next = this.warmQueue.shift(); next; next = this.warmQueue.shift()) {
        if (this.ready(next.key)) continue;
        await this.makeAll(next.key, next.original).catch((e) => this.onWarmError(next.key, e));
      }
    } finally {
      this.warming = false;
    }
  }

  /** Two requests for the same new photo share one download and resize. */
  private makeAll(key: string, original: Original): Promise<void> {
    let job = this.pending.get(key);
    if (!job) {
      job = this.make(key, original).finally(() => this.pending.delete(key));
      this.pending.set(key, job);
    }
    return job;
  }

  private async make(key: string, original: Original) {
    await this.slot();
    const temps: string[] = [];
    try {
      // Download first: a Drive error (lost access, file gone) then stops here, before any resizing.
      const stream = await original();
      const input = sharp({ limitInputPixels: 400_000_000 }).rotate(); // apply the camera's orientation flag
      const outputs = PHOTO_SIZES.map((size) => {
        const temp = `${this.path(key, size)}.${process.pid}.${Date.now()}.tmp`;
        temps.push(temp);
        return input
          .clone()
          .resize(size, size, { fit: 'inside', withoutEnlargement: true })
          .flatten({ background: '#ffffff' }) // transparent PNGs get a white background, not black
          .jpeg({ quality: 80, mozjpeg: true })
          .toFile(temp)
          .then(() => ({ temp, target: this.path(key, size) }));
      });
      stream.on('error', (e) => input.destroy(e)).pipe(input);
      const done = await Promise.allSettled(outputs);
      const failed = done.find((d) => d.status === 'rejected');
      if (failed) throw failed.reason;
      // Rename last, so a half-written file is never served.
      for (const d of done) if (d.status === 'fulfilled') await rename(d.value.temp, d.value.target);
    } catch (e) {
      await Promise.all(temps.map((t) => unlink(t).catch(() => undefined)));
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
