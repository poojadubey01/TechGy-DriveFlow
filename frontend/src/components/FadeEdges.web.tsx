import { StyleSheet } from 'react-native';

import type { FadeEdgesProps } from './FadeEdges';

/** Web version of FadeEdges: the same soft edges with a CSS mask (MaskedView is native-only). */
export function FadeEdges({ start = 20, end = 24, startInset = 0, endInset = 0, horizontal, style, children }: FadeEdgesProps) {
  const side = horizontal ? 'to right' : 'to bottom';
  const mask = `linear-gradient(${side}, transparent 0, transparent ${startInset}px, #000 ${startInset + start}px, #000 calc(100% - ${end + endInset}px), transparent calc(100% - ${endInset}px), transparent 100%)`;
  const flat = (StyleSheet.flatten(style) ?? {}) as Record<string, unknown>;
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: horizontal ? 'row' : 'column',
        ...(horizontal ? {} : { flex: 1, minHeight: 0 }),
        ...(flat as object),
        maskImage: mask,
        WebkitMaskImage: mask,
      }}
    >
      {children}
    </div>
  );
}
