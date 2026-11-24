import { StatusBar } from 'expo-status-bar';
import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { haptic } from '@/hooks/haptics';
import { colors, glow } from '@/theme/tokens';

import { GlowBackground } from './glow/GlowBackground';
import type { GlowBlob } from './glow/types';
import { TopBar } from './ui/TopBar';
import { FadeEdges } from './FadeEdges';

const BLOBS: readonly GlowBlob[] = [
  { x: 0.5, y: 0.95, r: 0.62, color: glow.mid, opacity: 0.35 },
  { x: 0.95, y: -0.05, r: 0.4, color: glow.mist },
];

type Props = {
  title: string;
  right?: ReactNode;
  /** Content pinned under the top bar (search field, filter chips). */
  header?: ReactNode;
  /** Pinned at the bottom (main action). */
  footer?: ReactNode;
  /** Changing this resets the scroll to the top (e.g. when switching tabs). */
  scrollKey?: string;
  /** Overrides the back button (e.g. to block it while something is saving). */
  onBack?: () => void;
  children: ReactNode;
};

/** Shared layout for secondary pages: soft glow, back button + title, scrolling content. */
export function PageShell({ title, right, header, footer, scrollKey, onBack, children }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <View className="flex-1 bg-canvas">
      <StatusBar style="dark" />
      <GlowBackground blobs={BLOBS} />
      <View className="px-5" style={{ paddingTop: insets.top + 10 }}>
        <TopBar title={title} right={right} onBack={onBack} />
        {header ? <View className="mt-4">{header}</View> : null}
      </View>
      {/* 'padding' on both platforms: with Android edge-to-edge the window no longer resizes for the
          keyboard, so the list shrinks instead and keeps the focused field and footer above it. */}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
      {/* Content melts into the background at the top and bottom instead of being cut off. */}
      <FadeEdges start={18} end={footer ? 18 : 28}>
        <ScrollView
          key={scrollKey}
          className="flex-1"
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 18, paddingBottom: footer ? 20 : insets.bottom + 32 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      </FadeEdges>
      {footer ? (
        <View className="px-4 pt-2" style={{ paddingBottom: insets.bottom + 14 }}>
          {footer}
        </View>
      ) : null}
      </KeyboardAvoidingView>
    </View>
  );
}

/** Small uppercase section label. */
export function SectionLabel({ text }: { text: string }) {
  return (
    <Text className="mb-2 mt-5 px-2 font-jk-semibold text-[12px] uppercase tracking-[1.2px] text-muted" accessibilityRole="header">
      {text}
    </Text>
  );
}

/** Row of single-choice filter pills. */
/** `bleed` = the side padding of the container, so the row can scroll to the screen edges and fade there. */
export function FilterPills<T extends string>({ options, value, onChange, bleed = 20 }: { options: readonly T[]; value: T; onChange: (v: T) => void; bleed?: number }) {
  return (
    <FadeEdges horizontal start={Math.min(16, bleed)} end={Math.min(16, bleed)} style={{ marginHorizontal: -bleed }}>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: bleed }} accessibilityRole="radiogroup">
      {options.map((o) => {
        const on = o === value;
        return (
          <Pressable
            key={o}
            onPress={() => {
              if (on) return;
              haptic.select();
              onChange(o);
            }}
            hitSlop={4}
            accessibilityRole="radio"
            accessibilityLabel={o}
            accessibilityState={{ checked: on }}
          >
            <View
              style={{
                height: 40,
                paddingHorizontal: 16,
                borderRadius: 20,
                borderWidth: 1.5,
                justifyContent: 'center',
                borderColor: on ? colors.brand : colors.edge,
                backgroundColor: on ? colors.brand : colors.card,
              }}
            >
              <Text className={`font-jk-semibold text-[13px] ${on ? 'text-white' : 'text-brand-deep'}`}>{o}</Text>
            </View>
          </Pressable>
        );
      })}
    </ScrollView>
    </FadeEdges>
  );
}
