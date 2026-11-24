import { router, useCanGoBack, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ChevronLeft, Download, Eye, Link2Off, Mail } from 'lucide-react-native';
import { useState } from 'react';
import { FlatList, Linking, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BrandTag } from '@/components/BrandTag';
import { GlowBackground } from '@/components/glow/GlowBackground';
import { SlideView } from '@/components/SlideView';
import type { GlowBlob } from '@/components/glow/types';
import { IconButton, PillButton } from '@/components/ui/Button';
import { PressableScale } from '@/components/ui/PressableScale';
import { Toast } from '@/components/ui/Toast';
import { useDeckByShareId } from '@/data/app';
import { useBrand } from '@/data/brand';
import { type DeckSlide, getClient } from '@/data/clients';
import { useDeckSlides } from '@/data/deckEdits';
import { useShare } from '@/data/sharing';
import { useDeckTemplate } from '@/data/templates';
import { downloadDeckPdf } from '@/lib/deckPdf';
import { colors, fonts, glow, shadow } from '@/theme/tokens';
import { FadeEdges } from '@/components/FadeEdges';

const BLOBS: readonly GlowBlob[] = [
  { x: 0.3, y: -0.08, r: 0.62, color: glow.peri, opacity: 0.7 },
  { x: 0.95, y: 0.05, r: 0.42, color: glow.mist },
];

const Separator = () => <View style={{ height: 14 }} />;

/** Centered message for a link that doesn't exist or was turned off. */
function Notice({ title, body, canBack }: { title: string; body: string; canBack: boolean }) {
  const insets = useSafeAreaInsets();
  return (
    <View className="flex-1 bg-canvas" style={{ paddingTop: insets.top + 10 }}>
      <StatusBar style="dark" />
      <GlowBackground blobs={BLOBS} />
      <View className="px-5" style={{ height: 44 }}>
        {canBack ? <IconButton icon={ChevronLeft} label="Back" onPress={() => router.back()} /> : null}
      </View>
      <View className="flex-1 items-center justify-center px-8" style={{ paddingBottom: insets.bottom + 60 }}>
        <View style={{ width: 96, height: 96, borderRadius: 48, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.card, boxShadow: shadow.card }}>
          <Link2Off size={40} color={colors.muted} strokeWidth={1.6} />
        </View>
        <Text accessibilityRole="header" style={{ fontFamily: fonts.semibold, fontSize: 26, lineHeight: 32, letterSpacing: -0.6, color: colors.ink, marginTop: 24, textAlign: 'center' }}>
          {title}
        </Text>
        <Text className="mt-2 text-center font-jk text-[15px] leading-[22px] text-ink-soft">{body}</Text>
      </View>
    </View>
  );
}

/**
 * The client's view of a shared deck (what opens from https://driveflow.app/p/<shareId>).
 * Read-only: slides, optional PDF download, and a way to contact the sender. Who sent it comes
 * from the deck, never from whoever is viewing. Opened from the share popup ("Client view") it
 * shows a small banner so you know you're previewing.
 */
export default function SharedDeck() {
  const { slug } = useLocalSearchParams<{ slug?: string }>();
  const deck = useDeckByShareId(slug);
  const share = useShare(deck?.id ?? '');
  const template = useDeckTemplate(deck?.id ?? '');
  const slides = useDeckSlides(deck);
  const brand = useBrand();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const preview = useCanGoBack();

  if (!deck) return <Notice title="Link not found" body="Check the link, or ask whoever sent it for a new one." canBack={preview} />;
  const sender = deck.sender;
  if (!share.active) return <Notice title="This link is no longer active" body={`${sender?.name ?? 'The sender'} stopped sharing this deck. Ask them for a new link.`} canBack={preview} />;

  const client = getClient(deck.clientId);
  const type = deck.type;
  const from = brand.on ? brand.name : (sender?.name ?? 'DriveFlow');
  const pageW = Math.min(width - 32, 720);
  const pageH = Math.round(pageW * (9 / 16));

  const download = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await downloadDeckPdf(client, slides, { deck: deck.title, brand: brand.on ? { name: brand.name, accent: brand.accent } : null, template });
    } catch {
      setToast('Could not create the PDF');
    } finally {
      setBusy(false);
    }
  };
  const contact = async () => {
    if (!sender?.email) return;
    try {
      await Linking.openURL(`mailto:${sender.email}?subject=${encodeURIComponent(`${client.name} — ${deck.title}`)}`);
    } catch {
      setToast('No mail app found');
    }
  };

  const renderPage = ({ item, index }: { item: DeckSlide; index: number }) => (
    <View style={{ alignSelf: 'center', borderRadius: 16, boxShadow: shadow.card }} accessible accessibilityLabel={`Slide ${index + 1}: ${item.title}`}>
      <SlideView
        template={template}
        source={item.source}
        title={item.title}
        eyebrow={client.name}
        index={index}
        total={slides.length}
        brand={brand.on ? { name: brand.name, accent: brand.accent } : null}
        width={pageW}
        height={pageH}
        radius={16}
      />
    </View>
  );

  const header = (
    <View style={{ paddingHorizontal: 4, paddingBottom: 22 }}>
      {brand.on ? <BrandTag name={brand.name} accent={brand.accent} /> : <Text className="font-jk-semibold text-[13px] text-muted">Shared via DriveFlow</Text>}
      <Text className="mt-5 font-jk-semibold text-[12px] uppercase tracking-[1.2px] text-muted">Prepared for {client.name}</Text>
      <Text accessibilityRole="header" style={{ fontFamily: fonts.semibold, fontSize: 30, lineHeight: 36, letterSpacing: -0.8, color: colors.ink, marginTop: 4 }}>
        {slides[0]?.title}
      </Text>
      <Text className="mt-1.5 font-jk text-[14px] text-ink-soft">
        {type} · {slides.length} slides · from {from}
      </Text>
    </View>
  );

  const showContact = !!sender?.email;
  const hasBar = share.allowPdf || showContact;

  return (
    <View className="flex-1 bg-canvas">
      <StatusBar style="dark" />
      <GlowBackground blobs={BLOBS} />
      {preview ? (
        <View className="mx-4 flex-row items-center gap-2.5 rounded-full bg-white/90 py-2 pl-4 pr-2" style={{ marginTop: insets.top + 8, boxShadow: shadow.soft }}>
          <Eye size={16} color={colors.brandDeep} strokeWidth={2} />
          <Text className="flex-1 font-jk text-[13px] text-ink-soft" numberOfLines={1}>
            Client view · what {client.name} sees
          </Text>
          <PressableScale onPress={() => router.back()} accessibilityLabel="Done previewing" style={{ height: 34, paddingHorizontal: 14, borderRadius: 17, justifyContent: 'center', backgroundColor: colors.brand }}>
            <Text className="font-jk-semibold text-[13px] text-white">Done</Text>
          </PressableScale>
        </View>
      ) : null}
      <FadeEdges start={preview ? 16 : insets.top + 12} end={hasBar ? insets.bottom + 96 : 24}>
      <FlatList
        data={slides}
        keyExtractor={(_, i) => String(i)}
        renderItem={renderPage}
        ListHeaderComponent={header}
        ItemSeparatorComponent={Separator}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: preview ? 20 : insets.top + 24, paddingBottom: insets.bottom + (hasBar ? 110 : 32) }}
        showsVerticalScrollIndicator={false}
        initialNumToRender={3}
        windowSize={5}
      />
      </FadeEdges>
      {hasBar ? (
        <View className="absolute left-4 right-4 flex-row gap-3" style={{ bottom: insets.bottom + 14 }}>
          {share.allowPdf ? (
            <PillButton
              label={busy ? 'Preparing…' : 'Download PDF'}
              variant={showContact ? 'secondary' : 'primary'}
              onPress={download}
              disabled={busy}
              flex={1}
              leading={<Download size={19} color={showContact ? colors.ink : colors.white} strokeWidth={2.2} />}
            />
          ) : null}
          {showContact ? (
            <PillButton label="Contact" onPress={contact} flex={1} leading={<Mail size={19} color={colors.white} strokeWidth={2.2} />} />
          ) : null}
        </View>
      ) : null}
      <Toast message={toast} onHide={() => setToast(null)} />
    </View>
  );
}
