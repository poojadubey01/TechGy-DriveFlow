import { Check, X } from 'lucide-react-native';
import { useEffect, useRef } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, { FadeOutUp, ReduceMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { enter } from '@/theme/motion';
import { colors, shadow } from '@/theme/tokens';

/** What a screen asks the toast to show. */
export type ToastMessage = {
  message: string;
  /** "error" shows a red cross instead of the tick, and stays a little longer. */
  tone?: 'success' | 'error';
  /** A button at the end, e.g. "Open" for a saved file. */
  action?: { label: string; onPress: () => void };
};

type Props = Partial<ToastMessage> & { onHide: () => void; ms?: number };

/** Small pill that drops in from the top and leaves on its own: a confirmation, or what went wrong. */
export function Toast({ message, onHide, tone = 'success', action, ms = action ? 5000 : tone === 'error' ? 3200 : 1800 }: Props) {
  const error = tone === 'error';
  const insets = useSafeAreaInsets();
  // Keep the latest callback without restarting the timer when the parent re-renders.
  const hide = useRef(onHide);
  useEffect(() => {
    hide.current = onHide;
  }, [onHide]);
  useEffect(() => {
    if (!message) return;
    const id = setTimeout(() => hide.current(), ms);
    return () => clearTimeout(id);
  }, [message, ms]);

  if (!message) return null;
  return (
    <Animated.View
      key={message}
      entering={enter.rise()}
      exiting={FadeOutUp.duration(200).reduceMotion(ReduceMotion.System)}
      pointerEvents={action ? 'box-none' : 'none'}
      accessibilityLiveRegion={error ? 'assertive' : 'polite'}
      style={{ position: 'absolute', top: insets.top + 12, alignSelf: 'center', zIndex: 50 }}
    >
      <View className="h-11 flex-row items-center gap-2 rounded-full bg-card px-4" style={{ boxShadow: shadow.lift }}>
        <View className="h-5 w-5 items-center justify-center rounded-full" style={{ backgroundColor: error ? colors.danger : colors.brand }}>
          {error ? <X size={12} color={colors.white} strokeWidth={3} /> : <Check size={12} color={colors.white} strokeWidth={3} />}
        </View>
        <Text className="font-jk-semibold text-[14px] text-ink">{message}</Text>
        {action ? (
          <Pressable
            onPress={() => {
              hide.current();
              action.onPress();
            }}
            accessibilityRole="button"
            accessibilityLabel={action.label}
            hitSlop={10}
            className="ml-1"
          >
            <Text className="font-jk-semibold text-[14px] text-brand">{action.label}</Text>
          </Pressable>
        ) : null}
      </View>
    </Animated.View>
  );
}
