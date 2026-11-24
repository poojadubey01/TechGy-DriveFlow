import { BlurView } from 'expo-blur';
import type { ReactNode } from 'react';
import { Platform, type StyleProp, View, type ViewStyle } from 'react-native';

type Props = { children?: ReactNode; style?: StyleProp<ViewStyle>; intensity?: number };

/**
 * Glassmorphism surface. Real backdrop blur on iOS and web; on Android (where a blur
 * needs a dedicated blur target) it falls back to frosted translucent white.
 */
export function Glass({ children, style, intensity = 40 }: Props) {
  if (Platform.OS === 'android') {
    return <View style={[{ backgroundColor: 'rgba(255,255,255,0.82)', overflow: 'hidden' }, style]}>{children}</View>;
  }
  return (
    <BlurView intensity={intensity} tint="light" style={[{ overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.35)' }, style]}>
      {children}
    </BlurView>
  );
}
