import { Image } from 'expo-image';
import { ArrowUp, X } from 'lucide-react-native';
import { useEffect } from 'react';
import { type KeyboardTypeOptions, Pressable, Text, TextInput, View } from 'react-native';
import Animated, { interpolateColor, useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';

import type { Client } from '@/data/clients';
import { haptic } from '@/hooks/haptics';
import { duration, spring } from '@/theme/motion';
import { colors, shadow } from '@/theme/tokens';

export const MAX_MESSAGE = 280;

type Props = {
  value: string;
  onChangeText: (t: string) => void;
  onSend: () => void;
  tagged?: Client;
  onClearTag?: () => void;
  focused?: boolean;
  placeholder?: string;
  editable?: boolean;
  autoFocus?: boolean;
  onFocusChange?: (focused: boolean) => void;
  /** e.g. 'number-pad' while the assistant asks for a slide count. */
  keyboardType?: KeyboardTypeOptions;
};

/** Message bar. The send button springs alive (colour + lift) once there is something to send. */
export function Composer({ value, onChangeText, onSend, tagged, onClearTag, focused, placeholder, editable = true, autoFocus, onFocusChange, keyboardType = 'default' }: Props) {
  const ready = value.trim().length > 0 || tagged !== undefined;
  const live = useSharedValue(ready ? 1 : 0);
  const pop = useSharedValue(1);

  useEffect(() => {
    live.set(withTiming(ready ? 1 : 0, { duration: duration.base }));
    if (ready) pop.set(withSequence(withTiming(0.82, { duration: 90 }), withSpring(1, spring.pop)));
  }, [live, pop, ready]);

  // All styles live in the one animated object: on native, mixing a fixed style array with an
  // animated style dropped the fixed part (size and radius).
  const send = useAnimatedStyle(() => ({
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: interpolateColor(live.value, [0, 1], [colors.lav, colors.brand]),
    transform: [{ scale: pop.value * (0.92 + 0.08 * live.value) }],
  }));

  return (
    <View>
      {tagged && (
        <View className="mb-2 ml-2 flex-row items-center gap-2 self-start rounded-full bg-card py-1 pl-1 pr-2" style={{ boxShadow: shadow.soft }}>
          <Image source={tagged.cover} style={{ width: 24, height: 24, borderRadius: 12 }} contentFit="cover" accessible={false} />
          <Text className="font-jk-semibold text-[13px] text-brand-deep">@{tagged.name}</Text>
          <Pressable onPress={onClearTag} hitSlop={10} accessibilityRole="button" accessibilityLabel={`Remove ${tagged.name}`}>
            <X size={14} color={colors.muted} strokeWidth={2.2} />
          </Pressable>
        </View>
      )}
      <View
        className="h-[60px] flex-row items-center rounded-full bg-card pl-[22px] pr-2"
        style={{ boxShadow: shadow.lift, borderWidth: 1.5, borderColor: focused ? colors.edge : 'transparent' }}
      >
        <TextInput
          value={value}
          onChangeText={(t) => onChangeText(t.slice(0, MAX_MESSAGE))}
          placeholder={placeholder ?? 'Message… type @ to tag a client'}
          placeholderTextColor={colors.placeholder}
          maxLength={MAX_MESSAGE}
          editable={editable}
          keyboardType={keyboardType}
          autoFocus={autoFocus}
          onFocus={() => onFocusChange?.(true)}
          onBlur={() => onFocusChange?.(false)}
          returnKeyType="send"
          onSubmitEditing={() => ready && onSend()}
          autoCorrect={false}
          autoCapitalize="sentences"
          accessibilityLabel="Message"
          className="flex-1 font-jk text-[15px] text-ink"
          style={{ paddingVertical: 0, outlineStyle: 'none' } as object}
        />
        <Pressable
          disabled={!editable}
          onPress={() => {
            if (!ready) {
              haptic.warn();
              return;
            }
            haptic.press();
            onSend();
          }}
          accessibilityRole="button"
          accessibilityLabel="Send"
          accessibilityState={{ disabled: !ready }}
          hitSlop={8}
        >
          <Animated.View style={send}>
            <ArrowUp size={20} color={colors.white} strokeWidth={2.4} />
          </Animated.View>
        </Pressable>
      </View>
    </View>
  );
}
