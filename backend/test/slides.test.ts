import { describe, expect, it } from 'vitest';

import { buildSlides, coverTitle, kindFromText, pickPhotos, uniqueTitle } from '../src/domain/slides.js';
import { deviceFromUserAgent } from '../src/lib/device.js';
import { isShareId, newShareId, Secrets } from '../src/lib/crypto.js';

const p = (id: string, kind: string | null) => ({ id, kind });

describe('deck builder rules (same as the app)', () => {
  it('reads photo kinds from words and file names', () => {
    expect(kindFromText('villas-night.jpg')?.kind).toBe('night');
    expect(kindFromText('Master_Bedroom_02.JPG')?.kind).toBe('interior');
    expect(kindFromText('pool and garden')?.kind).toBe('exterior');
    expect(kindFromText('IMG_2041.jpg')).toBeNull();
  });

  it('names decks from the client', () => {
    expect(coverTitle({ name: 'Highrize Villas', meta: 'Luxury villas' }, 'Portfolio')).toBe('Luxury villa portfolio');
    expect(coverTitle({ name: 'Highrize Villas', meta: '' }, 'Proposal')).toBe('Highrize Villas proposal');
    expect(uniqueTitle('Luxury villa portfolio', new Set(['Luxury villa portfolio', 'Luxury villa portfolio 2']))).toBe('Luxury villa portfolio 3');
  });

  it('cycles photos and titles slides by what they show', () => {
    const slides = buildSlides([p('a', 'exterior'), p('b', 'interior'), p('c', null)], 5, 'My deck');
    expect(slides.map((s) => s.photoId)).toEqual(['a', 'b', 'c', 'a', 'b']);
    expect(slides.map((s) => s.title)).toEqual(['My deck', 'Living spaces that open up', 'Arrival and first impressions', 'Set among green open spaces', 'Made for long family dinners']);
    expect(buildSlides([], 5, 'x')).toEqual([]);
  });

  it('tops up a thin photo choice', () => {
    const gallery = [p('1', 'exterior'), p('2', 'interior'), p('3', 'interior'), p('4', 'night'), p('5', 'exterior')];
    expect(pickPhotos(gallery, 'Best of everything').photos).toHaveLength(5);
    const night = pickPhotos(gallery, 'Night renders');
    expect(night.photos.map((x) => x.id)).toEqual(['4', '1', '2', '3']);
    expect(night.note).toBe('I found only 1 night render, so I added some of your best photos.');
  });
});

describe('small helpers', () => {
  it('makes unguessable share codes', () => {
    const codes = new Set(Array.from({ length: 500 }, newShareId));
    expect(codes.size).toBe(500);
    for (const c of codes) expect(isShareId(c)).toBe(true);
    expect(isShareId('k7q2m9xw4hpa')).toBe(true);
    expect(isShareId('K7Q2M9XW4HPA')).toBe(false);
  });

  it('encrypts and decrypts secrets, and detects tampering', () => {
    const s = new Secrets(Buffer.alloc(32, 3).toString('base64'));
    const sealed = s.encrypt('1//refresh-token');
    expect(sealed).not.toContain('refresh');
    expect(s.decrypt(sealed)).toBe('1//refresh-token');
    const tampered = sealed.slice(0, -2) + (sealed.endsWith('A') ? 'BB' : 'AA');
    expect(() => s.decrypt(tampered)).toThrow();
  });

  it('guesses the device from the browser', () => {
    expect(deviceFromUserAgent('Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X)')).toBe('tablet');
    expect(deviceFromUserAgent('Mozilla/5.0 (Linux; Android 16; Pixel 10) Mobile Safari')).toBe('phone');
    expect(deviceFromUserAgent('Mozilla/5.0 (Linux; Android 16; SM-X910)')).toBe('tablet');
    expect(deviceFromUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 15_0)')).toBe('laptop');
    expect(deviceFromUserAgent(undefined)).toBe('laptop');
  });
});
