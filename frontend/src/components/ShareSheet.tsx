import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { Eye, Link2, Link2Off, Mail, MessageCircle } from 'lucide-react-native';
import { useEffect } from 'react';
import { BackHandler, Linking, Pressable, Share, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, { interpolate, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { type Deck, deckClient, shareLink } from '@/data/app';

import { setShare, useShare } from '@/data/sharing';
import { haptic } from '@/hooks/haptics';
import { confirmAction } from '@/lib/confirm';
import { spring } from '@/theme/motion';
import { colors, shadow } from '@/theme/tokens';

import { PillButton, RoundAction } from './ui/Button';
import { PressableScale } from './ui/PressableScale';
import { Toggle } from './ui/Toggle';

type Props = {
  deck: Deck;
  open: boolean;
  onClose: () => void;
  onToast: (message: string) => void;
};

/**
 * "Share with <client>" popup: slides up from the bottom over a dimmed backdrop.
 * Closes on backdrop tap, a downward swipe, or the Android back button.
 * It stays mounted (off-screen, untouchable) so opening is instant.
 */
export function ShareSheet({ deck, open, onClose, onToast }: Props) {
  const insets = useSafeAreaInsets();
  const { height: winH } = useWindowDimensions();
  const client = deckClient(deck);
  const key = deck.id;
  const share = useShare(key);
  const link = shareLink(deck);
  const message = `${client.name} — ${deck.title}. View it here: ${link}`;

  const p = useSharedValue(0); // 0 closed … 1 open
  const drag = useSharedValue(0); // finger offset while swiping down

  useEffect(() => {
    drag.set(0);
    p.set(open ? withSpring(1, spring.settle) : withTiming(0, { duration: 220 }));
  }, [drag, open, p]);

  // Android back button closes the popup instead of leaving the screen.
  useEffect(() => {
    if (!open) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose();
      return true;
    });
    return () => sub.remove();
  }, [onClose, open]);

  const pan = usePanGesture({
    activeOffsetY: 8,
    onUpdate: (e) => {
      'worklet';
      drag.set(Math.max(0, e.translationY));
    },
    onDeactivate: (e) => {
      'worklet';
      if (e.translationY > 110 || e.velocityY > 900) {
        scheduleOnRN(haptic.select);
        scheduleOnRN(onClose);
      } else {
        drag.set(withSpring(0, spring.settle));
      }
    },
  });

  const backdrop = useAnimatedStyle(() => ({
    position: 'absolute',
    left: 0,
    top: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(18, 21, 42, 0.38)',
    opacity: p.value * interpolate(drag.value, [0, 300], [1, 0.4], 'clamp'),
  }));
  const sheet = useAnimatedStyle(() => ({
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    backgroundColor: colors.canvas,
    boxShadow: shadow.sheet,
    paddingBottom: insets.bottom + 18,
    transform: [{ translateY: (1 - p.value) * winH + drag.value }],
  }));

  const shareSystem = async () => {
    try {
      await Share.share({ message, title: deck.title });
    } catch {
      onToast('Sharing is not available here');
    }
  };
  const email = async () => {
    const url = `mailto:?subject=${encodeURIComponent(`${client.name} — ${deck.title}`)}&body=${encodeURIComponent(message)}`;
    try {
      await Linking.openURL(url);
    } catch {
      onToast('No mail app found');
    }
  };
  const stopSharing = () =>
    confirmAction('Stop sharing this deck?', 'The link stops working straight away. Anyone who opens it will see it is no longer active.', 'Stop sharing', () => {
      setShare(key, { active: false });
      haptic.warn();
      onToast('Link turned off');
    });
  const resume = () => {
    setShare(key, { active: true });
    haptic.success();
    onToast('Sharing is on again');
  };
  const previewAsClient = () => {
    onClose();
    router.push({ pathname: '/p/[slug]', params: { slug: deck.shareId } });
  };

  const copy = async () => {
    try {
      await Clipboard.setStringAsync(link);
      haptic.success();
      onToast('Link copied');
    } catch {
      onToast('Could not copy the link');
    }
  };

  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents={open ? 'auto' : 'none'}
      accessibilityElementsHidden={!open}
      importantForAccessibility={open ? 'yes' : 'no-hide-descendants'}
      accessibilityViewIsModal={open}
    >
      <Animated.View style={backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close share options" />
      </Animated.View>

      <Animated.View style={sheet}>
        <GestureDetector gesture={pan}>
          <View>
            <View className="items-center pb-1 pt-2.5" accessibilityRole="adjustable" accessibilityLabel="Drag down to close">
              <View className="h-[5px] w-11 rounded-full bg-[#D5D9E6]" />
            </View>
            <View className="px-6 pb-1 pt-2">
              <Text className="font-jk-semibold text-[22px] tracking-[-0.4px] text-ink" accessibilityRole="header">
                Share with {client.name}
              </Text>
              <Text className="mt-1 font-jk text-[14px] text-muted">{share.active ? 'View-only link. You can stop sharing any time.' : 'This deck isn’t shared right now.'}</Text>
            </View>
          </View>
        </GestureDetector>

        {share.active ? (
          <>
        <View className="mt-5 flex-row justify-between px-6">
          <RoundAction icon={MessageCircle} label="Message" onPress={shareSystem} />
          <RoundAction icon={Mail} label="Email" onPress={email} />
          <RoundAction icon={Link2} label="Copy link" onPress={copy} />
        </View>

        <View className="mx-4 mt-5 h-[52px] flex-row items-center gap-2.5 rounded-full bg-card pl-[18px] pr-2" style={{ boxShadow: shadow.soft }}>
          <Link2 size={18} color={colors.muted} strokeWidth={1.8} />
          <Text className="flex-1 font-jk text-[14px] text-ink-soft" numberOfLines={1} selectable>
            {link.replace('https://', '')}
          </Text>
          <PressableScale onPress={copy} feedback="none" accessibilityLabel="Copy link" className="h-9 justify-center rounded-full bg-brand-sky px-3.5">
            <Text className="font-jk-semibold text-[13px] text-brand-deep">Copy</Text>
          </PressableScale>
        </View>

        <View className="mx-6 mt-3.5 flex-row items-center justify-between">
          <Text className="font-jk text-[14px] text-ink-soft">Let the client download the PDF</Text>
          <Toggle value={share.allowPdf} onChange={(v) => setShare(key, { allowPdf: v })} label="Let the client download the PDF" />
        </View>

        <View className="mx-4 mt-6">
          <PillButton label="Send to client" onPress={shareSystem} />
        </View>

        <View className="mx-6 mt-4 flex-row items-center justify-between">
          <Pressable onPress={previewAsClient} hitSlop={8} accessibilityRole="button" accessibilityLabel={`See what ${client.name} sees`}>
            <View className="flex-row items-center gap-1.5 py-1">
              <Eye size={16} color={colors.brandDeep} strokeWidth={2} />
              <Text className="font-jk-semibold text-[14px] text-brand-deep">Client view</Text>
            </View>
          </Pressable>
          <Pressable onPress={stopSharing} hitSlop={8} accessibilityRole="button" accessibilityLabel="Stop sharing this deck">
            <View className="py-1">
              <Text className="font-jk-semibold text-[14px]" style={{ color: colors.danger }}>
                Stop sharing
              </Text>
            </View>
          </Pressable>
        </View>
          </>
        ) : (
          <>
            <View className="mx-4 mt-5 items-center rounded-[22px] bg-card px-6 py-6" style={{ boxShadow: shadow.soft }}>
              <Link2Off size={26} color={colors.muted} strokeWidth={1.8} />
              <Text className="mt-2 font-jk-semibold text-[16px] text-ink">Sharing is off</Text>
              <Text className="mt-1 text-center font-jk text-[13px] leading-[19px] text-muted">The link no longer opens. {client.name} will see that it isn’t active.</Text>
            </View>
            <View className="mx-4 mt-6">
              <PillButton label="Turn sharing back on" onPress={resume} />
            </View>
          </>
        )}
      </Animated.View>
    </View>
  );
}
