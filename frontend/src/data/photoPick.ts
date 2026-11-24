import type { Asset } from './clients';

/**
 * Hand-off from the photo picker back to the chat. The chat registers a handler while it is
 * waiting for the "which photos?" answer; the picker calls `deliverPick` when you confirm.
 */
type Handler = (photos: Asset[]) => void;
let handler: Handler | null = null;

export function setPickHandler(next: Handler | null) {
  handler = next;
}

/** Returns false if nothing is waiting for a pick (the picker then just closes). */
export function deliverPick(photos: Asset[]): boolean {
  if (!handler) return false;
  handler(photos);
  return true;
}
