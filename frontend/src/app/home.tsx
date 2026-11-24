import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { StatusBar } from 'expo-status-bar';
import { ArrowUp, Bell, ChevronRight, FileText, HardDrive, LayoutDashboard, LayoutGrid, Presentation } from 'lucide-react-native';
import { ScrollView as RNScrollView, Text, View } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ClientCard } from '@/components/ClientCard';
import { DeckCard } from '@/components/DeckCard';
import { GlowBackground } from '@/components/glow/GlowBackground';
import type { GlowBlob } from '@/components/glow/types';
import { IconButton, RoundAction } from '@/components/ui/Button';
import { PressableScale } from '@/components/ui/PressableScale';
import { loadDecks, loadNotifications, useDecks, useUnreadCount } from '@/data/app';
import { refreshDrive } from '@/services/drive';
import { type DeckType, useClients } from '@/data/clients';
import { firstName, initials, useSession } from '@/data/session';
import { enter } from '@/theme/motion';
import { colors, fonts, glow, shadow } from '@/theme/tokens';
import { FadeEdges } from '@/components/FadeEdges';

/** Good morning / afternoon / evening by the phone's clock. */
function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

const BLOBS: readonly GlowBlob[] = [
  { x: 0.5, y: 0.82, r: 0.68, color: glow.mid, opacity: 0.5, drift: 30 },
  { x: 0.92, y: -0.04, r: 0.42, color: glow.mist, drift: 22, phase: 0.4 },
];

function startChat(params: { client?: string; type?: DeckType } = {}) {
  router.push({ pathname: '/chat', params });
}

/** 02 Home */
export default function Home() {
  const insets = useSafeAreaInsets();
  const unread = useUnreadCount();
  const recent = useDecks().slice(0, 5);
  const clients = useClients();
  const { user, drive } = useSession();

  // Coming back to Home picks up new decks, client views and notifications.
  useFocusEffect(
    useCallback(() => {
      loadDecks().catch(() => undefined);
      loadNotifications().catch(() => undefined);
      refreshDrive().catch(() => undefined);
    }, []),
  );
  const driveReady = drive.connected && !!drive.folder;
  const scrollY = useSharedValue(0);

  const onScroll = useAnimatedScrollHandler((e) => {
    scrollY.set(e.contentOffset.y);
  });

  // Scroll-linked: the big title drifts up and fades; a frosted bar fades in behind the header.
  const titleStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, 90], [1, 0], Extrapolation.CLAMP),
    transform: [
      { translateY: interpolate(scrollY.value, [0, 90], [0, -18], Extrapolation.CLAMP) },
      { scale: interpolate(scrollY.value, [-80, 0], [1.06, 1], Extrapolation.CLAMP) },
    ],
  }));

  return (
    <View className="flex-1 bg-canvas">
      <StatusBar style="dark" />
      <GlowBackground blobs={BLOBS} />

      <FadeEdges startInset={insets.top + 58} start={24} end={insets.bottom + 96}>
      <Animated.ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: insets.top + 84, paddingBottom: insets.bottom + 130, paddingHorizontal: 16 }}
      >
        <Animated.View style={titleStyle}><View className="px-2">
          <Animated.Text style={{ fontFamily: fonts.regular, fontSize: 15, color: colors.muted }}>
            {greeting()}{firstName(user) ? `, ${firstName(user)}` : ''}
          </Animated.Text>
          <View className="mt-1.5 flex-row items-start justify-between">
            <Animated.Text
              accessibilityRole="header"
              style={{ fontFamily: fonts.semibold, fontSize: 37, lineHeight: 42, letterSpacing: -1.2, color: colors.ink }}
            >
              Who are we{'\n'}creating for?
            </Animated.Text>
            <View className="mt-2 h-[30px] justify-center rounded-full bg-brand px-3.5">
              <Text className="font-jk-semibold text-[13px] text-white">{clients.length} {clients.length === 1 ? 'client' : 'clients'}</Text>
            </View>
          </View>
        </View></Animated.View>

        {!driveReady && (
          <PressableScale
            onPress={() => router.push(drive.connected ? '/choose-folder' : '/connect-drive')}
            scaleTo={0.98}
            accessibilityLabel={drive.connected ? 'Choose your projects folder' : 'Connect Google Drive'}
            containerStyle={{ marginTop: 20 }}
            style={{ borderRadius: 22, backgroundColor: colors.card, boxShadow: shadow.card, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1.5, borderColor: colors.edge }}
          >
            <View style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.brand }}>
              <HardDrive size={20} color={colors.white} strokeWidth={1.9} />
            </View>
            <View style={{ flex: 1 }}>
              <Text className="font-jk-semibold text-[15px] text-ink">{drive.connected ? 'Choose your projects folder' : 'Connect Google Drive'}</Text>
              <Text className="mt-0.5 font-jk text-[13px] text-muted">DriveFlow needs it to find your project photos.</Text>
            </View>
            <ChevronRight size={20} color={colors.brand} strokeWidth={2.2} />
          </PressableScale>
        )}

        <View className="mt-7 flex-row justify-between px-1">
          {(
            [
              { icon: Presentation, label: 'Portfolio' },
              { icon: FileText, label: 'Proposal' },
              { icon: LayoutDashboard, label: 'Moodboard' },
            ] as const
          ).map((a) => (
            <Animated.View key={a.label}>
              <RoundAction icon={a.icon} label={a.label} onPress={() => startChat({ type: a.label })} />
            </Animated.View>
          ))}
        </View>

        <View className="mb-3 mt-7 flex-row items-center justify-between px-2">
          <Text className="font-jk-semibold text-[18px] text-ink" accessibilityRole="header">
            Your clients
          </Text>
          <PressableScale onPress={() => router.push('/clients')} feedback="tap" accessibilityLabel="See all clients" accessibilityRole="link">
            <Text className="font-jk-semibold text-[14px] text-brand-deep">See all</Text>
          </PressableScale>
        </View>

        <Animated.View entering={enter.fade()}>
          <View className="gap-2">
            {clients.slice(0, 6).map((c, i) => (
              <ClientCard key={c.id} client={c} index={i} onPress={() => startChat({ client: c.id })} />
            ))}
          </View>
        </Animated.View>

        {recent.length > 0 && (
          <>
            <View className="mb-3 mt-7 flex-row items-center justify-between px-2">
              <Text className="font-jk-semibold text-[18px] text-ink" accessibilityRole="header">
                Recent decks
              </Text>
              <PressableScale onPress={() => router.push('/decks')} feedback="tap" accessibilityLabel="See all decks" accessibilityRole="link">
                <Text className="font-jk-semibold text-[14px] text-brand-deep">See all</Text>
              </PressableScale>
            </View>
            <RNScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -16 }} contentContainerStyle={{ gap: 10, paddingHorizontal: 16, paddingBottom: 6 }}>
              {recent.map((d) => (
                <DeckCard key={d.id} deck={d} width={236} />
              ))}
            </RNScrollView>
          </>
        )}
      </Animated.ScrollView>
      </FadeEdges>

      {/* Fixed header: the content fades out underneath it, so there's no hard edge. */}
      <View className="absolute left-0 right-0 top-0" style={{ paddingTop: insets.top + 10 }} pointerEvents="box-none">
        <View className="flex-row items-center justify-between px-5 pb-2" pointerEvents="box-none">
          <PressableScale onPress={() => router.push('/profile')} scaleTo={0.94} accessibilityLabel={`Profile and settings${user ? `, ${user.name}` : ''}`}>
            <LinearGradient
              colors={[colors.brand, '#8C98FF']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{ width: 52, height: 52, borderRadius: 18, alignItems: 'center', justifyContent: 'center' }}
            >
              <Text className="font-jk-semibold text-[18px] text-white">{initials(user)}</Text>
            </LinearGradient>
          </PressableScale>
          <View className="flex-row gap-2.5">
            <View>
              <IconButton icon={Bell} label={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'} onPress={() => router.push('/notifications')} />
              {unread > 0 && (
                <View
                  pointerEvents="none"
                  style={{ position: 'absolute', right: 9, top: 9, width: 10, height: 10, borderRadius: 5, backgroundColor: colors.brand, borderWidth: 2, borderColor: colors.card }}
                />
              )}
            </View>
            <IconButton icon={LayoutGrid} label="My decks" tint={colors.brand} onPress={() => router.push('/decks')} />
          </View>
        </View>
      </View>

      {/* Composer shortcut: opens the chat with the keyboard up */}
      <View className="absolute left-4 right-4" style={{ bottom: insets.bottom + 16 }}>
        <PressableScale
          onPress={() => router.push({ pathname: '/chat', params: { focus: '1' } })}
          scaleTo={0.98}
          accessibilityLabel="Message DriveFlow. Type @ to tag a client"
          className="h-[60px] flex-row items-center rounded-full bg-card pl-[22px] pr-2"
          style={{ boxShadow: shadow.lift }}
        >
          <Text className="flex-1 font-jk text-[15px]" style={{ color: colors.placeholder }}>Message… type @ to tag a client</Text>
          <View className="h-11 w-11 items-center justify-center rounded-full bg-brand">
            <ArrowUp size={20} color={colors.white} strokeWidth={2.4} />
          </View>
        </PressableScale>
      </View>

    </View>
  );
}
