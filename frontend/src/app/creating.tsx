import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ScrollView, Text, useWindowDimensions, View } from 'react-native';
import { cancelAnimation, useAnimatedReaction, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { DeckGone } from '@/components/DeckGone';
import { GlowBackground } from '@/components/glow/GlowBackground';
import type { GlowBlob } from '@/components/glow/types';
import { SlideGrid } from '@/components/SlideGrid';
import { type Step, StepsCard } from '@/components/StepsCard';
import { PillButton } from '@/components/ui/Button';
import { TopBar } from '@/components/ui/TopBar';
import { useBrand } from '@/data/brand';
import { useDeckSlides } from '@/data/deckEdits';
import { haptic } from '@/hooks/haptics';
import { useDeckRoute } from '@/hooks/useDeckRoute';
import { easing } from '@/theme/motion';
import { colors, fonts, glow } from '@/theme/tokens';
import { FadeEdges } from '@/components/FadeEdges';

const BLOBS: readonly GlowBlob[] = [
  { x: 0.5, y: 0.86, r: 0.7, color: glow.deep, opacity: 0.55, drift: 30 },
  { x: -0.02, y: -0.04, r: 0.4, color: glow.mist, drift: 20, phase: 0.6 },
];

const BUILD_MS = 7000;

/** 05 Creating — the deck is already saved; this shows it being put together, then opens Ready. */
export default function Creating() {
  const { deck, client } = useDeckRoute();
  const brand = useBrand();
  const slideList = useDeckSlides(deck);
  const slides = slideList.length;
  const photosUsed = new Set(slideList.map((s) => s.source)).size;
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();

  const progress = useSharedValue(0);
  const [percent, setPercent] = useState(0);

  const deckId = deck?.id;
  useEffect(() => {
    if (!deckId) return;
    const finish = () => {
      haptic.success();
      router.replace({ pathname: '/ready', params: { deck: deckId } });
    };
    // Runs once per build; cancelled if the user leaves, so it can never navigate from a dead screen.
    progress.set(
      withTiming(1, { duration: BUILD_MS, easing: easing.inOut }, (done) => {
        'worklet';
        if (done) scheduleOnRN(finish);
      }),
    );
    return () => cancelAnimation(progress);
  }, [deckId, progress]);

  // Bridge the UI-thread progress to a whole-number percent for the text (only 100 updates in total).
  useAnimatedReaction(
    () => Math.round(progress.value * 100),
    (v, prev) => {
      if (v !== prev) scheduleOnRN(setPercent, v);
    },
  );

  if (!deck || !client) return <DeckGone />;

  const steps: readonly Step[] = [
    { label: `Understood: ${deck.type.toLowerCase()} for ${client.name}`, at: 0 },
    { label: `Using your ${photosUsed} ${photosUsed === 1 ? 'photo' : 'photos'}`, at: 0.18 },
    { label: 'Wrote titles and captions', at: 0.4 },
    { label: brand.on ? `Applying your ${brand.name} brand` : 'Keeping it unbranded', at: 0.62 },
    { label: 'Getting the PDF ready', at: 0.86 },
  ];
  const built = Math.min(slides, Math.floor((percent / 100) * slides));
  const secondsLeft = Math.max(0, Math.ceil(((100 - percent) / 100) * (BUILD_MS / 1000)));
  const openDeck = () => router.replace({ pathname: '/ready', params: { deck: deck.id } });

  return (
    <View className="flex-1 bg-canvas">
      <StatusBar style="dark" />
      <GlowBackground blobs={BLOBS} />
      <View className="px-5" style={{ paddingTop: insets.top + 10 }}>
        <TopBar title={client.name} caption={deck.type} />
      </View>

      {/* Scrolls on short phones; the buttons stay pinned below. */}
      <FadeEdges start={16} end={22}>
      <ScrollView className="flex-1" contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
        <View className="mt-6 flex-row items-end justify-between px-2">
          <View>
            <Text className="font-jk text-[15px] text-muted">{percent < 100 ? 'Creating your deck' : 'Finishing up'}</Text>
            <View className="mt-1 flex-row items-baseline" accessibilityLabel={percent < 100 ? 'Creating your deck' : 'Deck ready'}>
              <Text style={{ fontFamily: fonts.semibold, fontSize: 60, lineHeight: 66, letterSpacing: -2, color: colors.ink, fontVariant: ['tabular-nums'] }}>
                {percent}
              </Text>
              <Text style={{ fontFamily: fonts.semibold, fontSize: 26, color: colors.inkSoft, marginLeft: 4 }}>%</Text>
            </View>
          </View>
          <View className="mb-3 h-[30px] justify-center rounded-full bg-brand px-3.5">
            <Text className="font-jk-semibold text-[13px] text-white">{secondsLeft > 0 ? `~${secondsLeft} sec left` : 'Done'}</Text>
          </View>
        </View>

        <View className="mt-6">
          <SlideGrid progress={progress} slides={slides} photos={slideList.map((s) => s.source)} maxTiles={height < 760 ? 8 : 12} />
        </View>

        <View className="mt-6">
          <StepsCard progress={progress} steps={steps} built={built} slides={slides} />
        </View>
      </ScrollView>
      </FadeEdges>

      <View className="flex-row gap-3 px-4 pt-2" style={{ paddingBottom: insets.bottom + 16 }}>
        <PillButton label="Back to chat" variant="secondary" flex={1} onPress={() => (router.canGoBack() ? router.back() : router.replace('/chat'))} />
        <PillButton label="Open deck" flex={1} onPress={openDeck} />
      </View>
    </View>
  );
}
