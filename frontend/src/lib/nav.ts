import { type Href, router } from 'expo-router';

let busyUntil = 0;

/**
 * Clears the back stack (when there is one) and opens `href`, so Back can't return to a finished
 * flow. Calls within 500 ms of the last one are ignored: the stack hasn't settled yet, and a second
 * "dismiss all" would have nothing left to dismiss.
 */
export function resetTo(href: Href) {
  const now = Date.now();
  if (now < busyUntil) return;
  busyUntil = now + 500;
  if (router.canDismiss()) router.dismissAll();
  router.replace(href);
}
