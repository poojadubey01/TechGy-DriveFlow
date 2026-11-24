import { Image } from 'expo-image';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Eye } from 'lucide-react-native';
import { useState } from 'react';
import { ScrollView, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DeckGone } from '@/components/DeckGone';
import { DeckMenu } from '@/components/DeckMenu';
import { GlowBackground } from '@/components/glow/GlowBackground';
import type { GlowBlob } from '@/components/glow/types';
import { ShareSheet } from '@/components/ShareSheet';
import { SlideView } from '@/components/SlideView';
import { TiltCard } from '@/components/TiltCard';
import { PillButton } from '@/components/ui/Button';
import { PressableScale } from '@/components/ui/PressableScale';
import { Toast } from '@/components/ui/Toast';
import { TopBar } from '@/components/ui/TopBar';

import { useBrand } from '@/data/brand';
import { useDeckSlides } from '@/data/deckEdits';
import { getTemplate, useDeckTemplate } from '@/data/templates';
import { useDeckRoute } from '@/hooks/useDeckRoute';
import { downloadDeckPdf } from '@/lib/deckPdf';
import { colors, fonts, glow, shadow } from '@/theme/tokens';
import { FadeEdges } from '@/components/FadeEdges';

const BLOBS: readonly GlowBlob[] = [
  { x: 0.5, y: 0.9, r: 0.7, color: glow.deep, opacity: 0.5, drift: 30 },
  { x: 0.95, y: -0.04, r: 0.42, color: glow.mist, drift: 22, phase: 0.3 },
];

/** 06 Ready */
export default function Ready() {
  const { deck, client } = useDeckRoute();
  const slideList = useDeckSlides(deck);
  const brand = useBrand();
  const template = useDeckTemplate(deck?.id ?? '');
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [shareOpen, setShareOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  if (!deck || !client) return <DeckGone />;

  const b = brand.on ? { name: brand.name, accent: brand.accent } : null;
  const cover = slideList[0];
  const slides = slideList.length;
  const coverH = Math.min(300, Math.max(190, Math.round(height * 0.3)));
  const templateName = getTemplate(template).name;
  const opens = deck.opens;
  const go = (pathname: '/preview' | '/activity' | '/templates' | '/edit-deck') => router.push({ pathname, params: { deck: deck.id } });

  const download = async (ready: () => void) => {
    try {
      await downloadDeckPdf(client, slideList, { deck: deck.title, onReady: ready, brand: b, template });
    } catch (e) {
      if (__DEV__) console.warn('[DriveFlow] PDF download failed:', e);
      setToast(e instanceof Error && e.message.startsWith('Allow') ? e.message : 'Could not create the PDF');
    }
  };
  const thumbs = slideList.slice(1, 4);
  const extra = slides - 1 - thumbs.length;

  return (
    <View className="flex-1 bg-canvas">
      <StatusBar style="dark" />
      <GlowBackground blobs={BLOBS} />
      <View className="px-5" style={{ paddingTop: insets.top + 10 }}>
        <TopBar
          title={client.name}
          caption={`${deck.type} · ${templateName}`}
          right={<DeckMenu onDownload={download} onShare={() => setShareOpen(true)} onEdit={() => go('/edit-deck')} onTemplate={() => go('/templates')} />}
        />
      </View>

      <FadeEdges start={16} end={22}>
      <ScrollView className="flex-1" contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
        <View className="mt-6 flex-row items-end justify-between px-2">
          <View>
            <Text className="font-jk text-[15px] text-muted">Your deck is ready</Text>
            <View className="mt-1 flex-row items-baseline gap-2" accessibilityLabel={`${slides} slides`}>
              <Text style={{ fontFamily: fonts.semibold, fontSize: 60, lineHeight: 66, letterSpacing: -2, color: colors.ink, fontVariant: ['tabular-nums'] }}>{slides}</Text>
              <Text style={{ fontFamily: fonts.semibold, fontSize: 24, color: colors.inkSoft }}>slides</Text>
            </View>
          </View>
          {/* Whether the client has opened the share link; tap for the activity page. */}
          <PressableScale
            onPress={() => go('/activity')}
            scaleTo={0.95}
            accessibilityLabel={opens ? `Opened ${opens} ${opens === 1 ? 'time' : 'times'} by ${client.name}. See client activity` : 'Not opened yet. See client activity'}
            containerStyle={{ marginBottom: 12 }}
            style={{
              height: 32,
              paddingHorizontal: 12,
              borderRadius: 16,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              backgroundColor: opens ? colors.brand : colors.card,
              borderWidth: opens ? 0 : 1.5,
              borderColor: colors.edge,
            }}
          >
            <Eye size={15} color={opens ? colors.white : colors.muted} strokeWidth={2.2} />
            <Text className="font-jk-semibold text-[13px]" style={{ color: opens ? colors.white : colors.inkSoft }}>
              {opens ? `Opened ${opens}×` : 'Not opened yet'}
            </Text>
          </PressableScale>
        </View>

        <View className="mt-5">
          <TiltCard height={coverH} style={{ borderRadius: 30, boxShadow: shadow.lift }}>
            <View accessible accessibilityRole="image" accessibilityLabel={`${deck.title} cover`}>
              {/* The cover in the deck's template (follows the deck's name, edits, photos and the brand kit). */}
              <SlideView
                template={template}
                source={cover?.source ?? client.cover}
                title={cover?.title ?? deck.title}
                eyebrow={client.name}
                index={0}
                brand={b}
                width={width - 32}
                height={coverH}
                radius={30}
                textScale={1.3}
                titleLines={2}
              />
            </View>
          </TiltCard>
        </View>

        <View className="mt-3.5 flex-row gap-2">
          {thumbs.map((s, i) => (
            <View key={i} style={{ flex: 1 }}>
              <Image source={s.source} style={{ height: 62, borderRadius: 14 }} contentFit="cover" accessible={false} />
            </View>
          ))}
          <PressableScale
            onPress={() => go('/preview')}
            accessibilityLabel={`See all ${slides} slides`}
            containerStyle={{ flex: 1 }}
            style={{ height: 62, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.card }}
          >
            <Text className="font-jk-semibold text-[14px] text-brand-deep">{extra > 0 ? `+${extra}` : 'All'}</Text>
          </PressableScale>
        </View>

        <View className="mt-3.5 h-[88px] flex-row items-center rounded-3xl border border-white bg-white/80">
          <View className="flex-1 items-center gap-1">
            <Text className="font-jk-semibold text-[20px] text-ink">{new Set(slideList.map((s) => s.source)).size}</Text>
            <Text className="font-jk text-[12px] text-muted">Photos used</Text>
          </View>
          <PressableScale onPress={() => go('/templates')} scaleTo={0.95} accessibilityLabel={`Template: ${templateName}. Change template`} containerStyle={{ flex: 1 }} style={{ alignItems: 'center', gap: 4 }}>
            <Text className="font-jk-semibold text-[20px] text-brand-deep">{templateName}</Text>
            <Text className="font-jk text-[12px] text-muted">Template ›</Text>
          </PressableScale>
          <View className="flex-1 items-center gap-1">
            <Text className="font-jk-semibold text-[20px] text-brand-deep">{brand.on ? 'On' : 'Off'}</Text>
            <Text className="font-jk text-[12px] text-muted">Brand kit</Text>
          </View>
        </View>
      </ScrollView>
      </FadeEdges>

      <View className="flex-row gap-3 px-4 pt-2" style={{ paddingBottom: insets.bottom + 16 }}>
        <PillButton label="Preview" variant="secondary" flex={1} onPress={() => go('/preview')} />
        <PillButton label="Share with client" flex={1.4} onPress={() => setShareOpen(true)} />
      </View>
      <ShareSheet deck={deck} open={shareOpen} onClose={() => setShareOpen(false)} onToast={setToast} />
      <Toast message={toast} onHide={() => setToast(null)} />
    </View>
  );
}
