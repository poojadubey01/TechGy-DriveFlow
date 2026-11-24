import { Asset } from 'expo-asset';
import { File, Paths } from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

import type { Client, DeckSlide } from '@/data/clients';
import type { TemplateId } from '@/data/templates';
import { colors } from '@/theme/tokens';

/** Escapes text placed into the PDF's HTML. */
function esc(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

/** Bundled image → data URI, so the PDF is self-contained (no network, no file paths). */
async function toDataUri(module: number): Promise<string> {
  const asset = Asset.fromModule(module);
  await asset.downloadAsync();
  const uri = asset.localUri ?? asset.uri;
  // The web print frame needs a full URL (it has no base path of its own).
  if (Platform.OS === 'web') return new URL(uri, window.location.href).href;
  const b64 = await new File(uri).base64();
  return `data:image/jpeg;base64,${b64}`;
}

/** Web: print the deck's own HTML in a hidden frame (expo-print on web only prints the current page). */
async function printOnWeb(doc: string, photos: string[]) {
  await Promise.all(
    photos.map(
      (src) =>
        new Promise((done) => {
          const im = new window.Image();
          im.onload = done;
          im.onerror = done;
          im.src = src;
        }),
    ),
  );
  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  Object.assign(frame.style, { position: 'fixed', right: '0', bottom: '0', width: '0', height: '0', border: '0' });
  document.body.appendChild(frame);
  const d = frame.contentDocument;
  const w = frame.contentWindow;
  if (!d || !w) {
    frame.remove();
    throw new Error('Printing is not available in this browser');
  }
  d.open();
  d.write(doc);
  d.close();
  // Wait for every photo to load (or fail) before opening the print dialog.
  await Promise.all(
    Array.from(d.images).map((img) =>
      img.complete
        ? null
        : new Promise((done) => {
            img.addEventListener('load', done);
            img.addEventListener('error', done);
          }),
    ),
  );
  w.focus();
  w.print();
  setTimeout(() => frame.remove(), 1000);
}

/** Brand shown on the cover page; `null` = unbranded. */
export type PdfBrand = { name: string; accent: string } | null;

type Page = { src: string; title: string };

/**
 * One 960 x 540 page per slide, in the chosen template. Same layouts as components/SlideView.tsx
 * (designed on a 320 x 180 grid, here at 3x).
 */
/** 1 x 1 transparent pixel: the <img> keeps its layout; the real photo comes from its CSS class. */
const PIXEL = 'data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==';

function html(client: Client, deck: string, pages: Page[], brand: PdfBrand, template: TemplateId) {
  // Each distinct photo is written once (as a CSS class) and reused by every slide that shows it,
  // so a 40-slide deck carries ~7 photos instead of 40 copies.
  const photoIndex = new Map<string, number>();
  pages.forEach((p) => {
    if (!photoIndex.has(p.src)) photoIndex.set(p.src, photoIndex.size);
  });
  const photoCss = [...photoIndex].map(([src, i]) => `.ph${i} { content: url("${src.replace(/"/g, '%22')}"); }`).join('\n');
  const accent = esc(brand?.accent ?? colors.brandDeep);
  const name = esc(client.name);
  const tag = (i: number) => (i === 0 && brand ? `<div class="brand" style="color:${accent}"><i style="background:${accent}"></i>${esc(brand.name)}</div>` : '');
  const pill = (i: number) => `<div class="pill">${i + 1} / ${pages.length}</div>`;
  const num = (i: number) => String(i + 1).padStart(2, '0');

  const slide = (p: Page, i: number) => {
    const img = `<img class="ph${photoIndex.get(p.src)}" src="${PIXEL}" alt="" />`;
    const title = esc(p.title);
    switch (template) {
      case 'editorial':
        return `<section class="page ed"><div class="ed-img">${img}</div>${tag(i)}
          <div class="ed-text"><div class="eyebrow" style="color:${accent}">${name}</div><div class="ed-title">${title}</div></div>
          <div class="ed-num">${num(i)}</div></section>`;
      case 'split':
        return `<section class="page sp"><div class="sp-img">${img}</div><div class="sp-panel">
          ${i === 0 && brand ? `<div class="sp-brand" style="color:${accent}">${esc(brand.name)}</div>` : `<div class="sp-num" style="color:${accent}">${num(i)}</div>`}
          <div><div class="sp-bar" style="background:${accent}"></div><div class="eyebrow sp-eyebrow">${name}</div><div class="sp-title">${title}</div></div>
          </div></section>`;
      case 'bold':
        return `<section class="page bd" style="background:${accent}"><div class="bd-img">${img}</div>${tag(i)}${pill(i)}
          <div class="bd-band"><div class="eyebrow bd-eyebrow">${name}</div><div class="bd-title">${title}</div></div></section>`;
      default:
        return `<section class="page cl">${img}<div class="shade"></div>${tag(i)}${pill(i)}
          <div class="cl-caption"><div class="eyebrow cl-eyebrow">${name}</div><div class="cl-title">${title}</div></div></section>`;
    }
  };

  return `<!doctype html><html><head><meta charset="utf-8"><style>
    @page { size: 720pt 405pt; margin: 0; }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; font-family: -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
    .page { position: relative; width: 960px; height: 540px; overflow: hidden; page-break-after: always; background: #fff; }
    .page:last-child { page-break-after: auto; }
    img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
    ${photoCss}
    .brand { position: absolute; left: 36px; top: 36px; background: #fff; font-size: 31px; font-weight: 600; height: 66px; padding: 0 27px; border-radius: 33px; display: flex; align-items: center; gap: 15px; }
    .brand i { width: 18px; height: 18px; border-radius: 9px; display: inline-block; }
    .pill { position: absolute; right: 36px; top: 36px; color: #fff; font-size: 28px; font-weight: 600; background: rgba(255,255,255,.22); height: 60px; line-height: 60px; padding: 0 24px; border-radius: 30px; }
    .eyebrow { font-size: 24px; font-weight: 600; letter-spacing: 3.3px; text-transform: uppercase; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .cl { background: ${colors.ink}; }
    .shade { position: absolute; left: 0; right: 0; bottom: 0; height: 60%; background: linear-gradient(180deg, rgba(20,30,120,0) 0%, rgba(20,30,120,0.75) 100%); }
    .cl-caption { position: absolute; left: 42px; right: 42px; bottom: 36px; color: #fff; }
    .cl-eyebrow { color: rgba(255,255,255,.85); }
    .cl-title { font-size: 48px; line-height: 60px; font-weight: 600; letter-spacing: -1.2px; margin-top: 6px; }
    .ed-img { position: absolute; left: 27px; top: 27px; right: 27px; height: 346px; border-radius: 27px; overflow: hidden; }
    .ed-text { position: absolute; left: 45px; right: 132px; top: 400px; }
    .ed-title { font-size: 42px; line-height: 54px; font-weight: 600; letter-spacing: -0.9px; color: ${colors.ink}; margin-top: 6px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .ed-num { position: absolute; right: 45px; bottom: 33px; font-size: 36px; font-weight: 600; color: ${colors.placeholder}; }
    .sp-img { position: absolute; right: 0; top: 0; bottom: 0; width: 56%; }
    .sp-panel { position: absolute; left: 0; top: 0; bottom: 0; width: 44%; padding: 42px; display: flex; flex-direction: column; justify-content: space-between; }
    .sp-brand { font-size: 30px; font-weight: 600; }
    .sp-num { font-size: 90px; line-height: 96px; font-weight: 700; opacity: .28; }
    .sp-bar { width: 48px; height: 9px; border-radius: 5px; }
    .sp-eyebrow { font-size: 21px; color: ${colors.muted}; margin-top: 21px; }
    .sp-title { font-size: 39px; line-height: 51px; font-weight: 600; letter-spacing: -0.9px; color: ${colors.ink}; margin-top: 6px; }
    .bd-img { position: absolute; left: 0; top: 0; right: 0; height: 66%; }
    .bd-band { position: absolute; left: 42px; right: 42px; top: 66%; bottom: 0; display: flex; flex-direction: column; justify-content: center; color: #fff; }
    .bd-eyebrow { font-size: 22.5px; color: rgba(255,255,255,.8); }
    .bd-title { font-size: 42px; line-height: 54px; font-weight: 600; letter-spacing: -0.9px; margin-top: 3px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  </style><title>${esc(`${client.name} — ${deck}`)}</title></head><body>${pages.map(slide).join('')}</body></html>`;
}

/** PDF page size in points: 960 x 540 CSS px at 0.75 pt per px. */
const PAGE_PT = { w: 720, h: 405 } as const;

/**
 * Builds the deck as a real PDF (one 16:9 page per slide) and opens the system sheet so the
 * user can save it to Downloads/Drive/Files or send it. On web, opens the print dialog instead.
 */
export async function downloadDeckPdf(
  client: Client,
  slides: DeckSlide[],
  { deck = 'Portfolio', onReady, brand = null, template = 'classic' }: { deck?: string; onReady?: () => void; brand?: PdfBrand; template?: TemplateId } = {},
): Promise<void> {
  // Decks repeat photos: read and encode each one once, then reuse it for every slide.
  const unique = [...new Set(slides.map((s) => s.source))];
  const uris = new Map(await Promise.all(unique.map(async (src) => [src, await toDataUri(src)] as const)));
  const pages = slides.map((s) => ({ src: uris.get(s.source)!, title: s.title }));
  const doc = html(client, deck, pages, brand, template);
  if (Platform.OS === 'web') {
    onReady?.();
    await printOnWeb(doc, [...uris.values()]);
    return;
  }
  // Ask for the PDF bytes and save them in the app's own cache under a readable name. The print
  // module's own output folder can't be read by the share sheet (Expo Go: "Not allowed to read file").
  // Android sizes the page in points (72/in) while the HTML is laid out in CSS px (96/in):
  // 720 x 405 pt is exactly the 960 x 540 px slide, so each slide fills one 16:9 page edge to edge.
  const { base64 } = await Print.printToFileAsync({ html: doc, width: PAGE_PT.w, height: PAGE_PT.h, base64: true });
  if (!base64) throw new Error('The PDF could not be generated');
  const name = `${client.name} - ${deck}.pdf`.replace(/[\\/:*?"<>|]+/g, '');
  const pdf = new File(Paths.cache, name);
  if (pdf.exists) pdf.delete();
  pdf.create();
  await pdf.write(base64, { encoding: 'base64' });

  if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing is not available on this device');
  onReady?.();
  // Let the closed menu be drawn before Android's share sheet pauses the app.
  await new Promise((resolve) => setTimeout(resolve, 250));
  await Sharing.shareAsync(pdf.uri, {
    mimeType: 'application/pdf',
    UTI: 'com.adobe.pdf',
    dialogTitle: `${client.name} — ${deck} (PDF)`,
  });
}
