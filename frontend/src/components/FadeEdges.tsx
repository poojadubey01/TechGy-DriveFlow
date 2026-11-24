import MaskedViewBase from '@react-native-masked-view/masked-view';
import { LinearGradient } from 'expo-linear-gradient';
import type { ComponentType, ReactElement, ReactNode } from 'react';
import { type StyleProp, View, type ViewProps, type ViewStyle } from 'react-native';

export type FadeEdgesProps = {
  /** Fade length at the start (top, or left when horizontal), in px. 0 = no fade. */
  start?: number;
  /** Fade length at the end (bottom, or right when horizontal), in px. 0 = no fade. */
  end?: number;
  /** Fully hidden band before the start fade (e.g. behind a floating header), in px. */
  startInset?: number;
  /** Fully hidden band after the end fade (e.g. behind a floating button), in px. */
  endInset?: number;
  horizontal?: boolean;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
};

// The package's class typings predate React 19's JSX types; the component itself works as normal.
const MaskedView = MaskedViewBase as unknown as ComponentType<ViewProps & { maskElement: ReactElement; androidRenderingMode?: 'software' | 'hardware' }>;

const SOLID = '#000';
const CLEAR = 'rgba(0,0,0,0)';

/**
 * Softly fades scrolling content out at its edges, so it melts into the background instead of
 * being cut off at a hard line. The content itself is masked (not covered), so the real glow
 * shows through. The mask never changes, so it uses Android's fast hardware rendering.
 */
export function FadeEdges({ start = 20, end = 24, startInset = 0, endInset = 0, horizontal, style, children }: FadeEdgesProps) {
  const dir = horizontal ? { start: { x: 0, y: 0 }, end: { x: 1, y: 0 } } : { start: { x: 0, y: 0 }, end: { x: 0, y: 1 } };
  const edge = (size: number) => (horizontal ? { width: size } : { height: size });
  return (
    <MaskedView
      style={[horizontal ? null : { flex: 1 }, style]}
      maskElement={
        <View style={{ flex: 1, flexDirection: horizontal ? 'row' : 'column' }}>
          {startInset > 0 ? <View style={edge(startInset)} /> : null}
          {start > 0 ? <LinearGradient colors={[CLEAR, SOLID]} {...dir} style={edge(start)} /> : null}
          <View style={{ flex: 1, backgroundColor: SOLID }} />
          {end > 0 ? <LinearGradient colors={[SOLID, CLEAR]} {...dir} style={edge(end)} /> : null}
          {endInset > 0 ? <View style={edge(endInset)} /> : null}
        </View>
      }
    >
      {children}
    </MaskedView>
  );
}
