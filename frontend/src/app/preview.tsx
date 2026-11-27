import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { FileText } from 'lucide-react-native';
import { useState } from 'react';
import { FlatList, type NativeScrollEvent, type NativeSyntheticEvent, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DeckGone } from '@/components/DeckGone';
import { DeckMenu } from '@/components/DeckMenu';
import { ShareSheet } from '@/components/ShareSheet';
import { SlideView } from '@/components/SlideView';
import { Toast } from '@/components/ui/Toast';
import { TopBar } from '@/components/ui/TopBar';
import { useBrand } from '@/data/brand';
import type { DeckSlide } from '@/data/clients';
import { useDeckSlides } from '@/data/deckEdits';
import { getTemplate, useDeckTemplate } from '@/data/templates';
import { useDeckRoute } from '@/hooks/useDeckRoute';
import { downloadDeckPdf } from '@/lib/deckPdf';
import { colors, shadow } from '@/theme/tokens';
import { FadeEdges } from '@/components/FadeEdges';

const GAP = 14;

/** 07 Preview — the generated deck shown like a PDF: one 16:9 page after another. */
export default function Preview() {
  const { deck, client } = useDeckRoute();
  const slides = useDeckSlides(deck);
  const brand = useBrand();
  const template = useDeckTemplate(deck?.id ?? '');
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [page, setPage] = useState(1);
  const [shareOpen, setShareOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  if (!deck || !client) return <DeckGone title="Preview" />;

  const b = brand.on ? { name: brand.name, accent: brand.accent } : null;
  const pageW = width - 32;
  const pageH = Math.round((pageW * 9) / 16);

  // Page counter follows the page at the top of the view (like a PDF reader); at the very end of
  // the list the last page can't reach the top, so the end of the scroll counts as the last page.
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, layoutMeasurement, contentSize } = e.nativeEvent;
    const atEnd = contentOffset.y + layoutMeasurement.height >= contentSize.height - 4;
    const next = atEnd ? slides.length : Math.min(slides.length, Math.max(1, Math.round(contentOffset.y / (pageH + GAP)) + 1));
    if (next !== page) setPage(next);
  };

  const download = async (ready: () => void) => {
    try {
      await downloadDeckPdf(client, slides, { deck: deck.title, onReady: ready, brand: b, template });
    } catch (e) {
      if (__DEV__) console.warn('[DriveFlow] PDF download failed:', e);
      setToast(e instanceof Error && e.message.startsWith('Allow') ? e.message : 'Could not create the PDF');
    }
  };

  const renderPage = ({ item, index }: { item: DeckSlide; index: number }) => (
    <View style={{ borderRadius: 14, boxShadow: shadow.card }} accessible accessibilityLabel={`Page ${index + 1}: ${item.title}`}>
      <SlideView template={template} source={item.source} title={item.title} eyebrow={client.name} index={index} total={slides.length} brand={b} width={pageW} height={pageH} radius={14} />
    </View>
  );

  return (
    <View className="flex-1" style={{ backgroundColor: '#E9EBF1' }}>
      <StatusBar style="dark" />
      <View className="px-5 pb-1" style={{ paddingTop: insets.top + 10 }}>
        <TopBar
          title={deck.title}
          caption={client.name}
          right={
            <DeckMenu
              onDownload={download}
              onShare={() => setShareOpen(true)}
              onEdit={() => router.push({ pathname: '/edit-deck', params: { deck: deck.id } })}
              onTemplate={() => router.push({ pathname: '/templates', params: { deck: deck.id } })}
            />
          }
        />
        <View className="mt-3 flex-row items-center justify-center gap-2">
          <FileText size={14} color={colors.muted} strokeWidth={2} />
          <Text className="font-jk-semibold text-[13px] text-muted">
            Page {page} of {slides.length} · {getTemplate(template).name}
          </Text>
        </View>
      </View>

      <FadeEdges start={16} end={24}>
      <FlatList
        data={slides}
        keyExtractor={(_, i) => String(i)}
        renderItem={renderPage}
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24, gap: GAP }}
        onScroll={onScroll}
        onScrollEndDrag={onScroll}
        onMomentumScrollEnd={onScroll}
        scrollEventThrottle={32}
        showsVerticalScrollIndicator
        initialNumToRender={4}
        windowSize={5}
      />
      </FadeEdges>

      <ShareSheet deck={deck} open={shareOpen} onClose={() => setShareOpen(false)} onToast={setToast} />
      <Toast message={toast} tone="error" onHide={() => setToast(null)} />
    </View>
  );
}
