import { router, useCanGoBack, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ChevronLeft, Download, Eye, Link2Off, Mail } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, FlatList, type FlatListProps, Linking, Platform, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { api, ApiError } from '@/api/client';
import { apiUrl } from '@/api/config';
import type { ApiPublicDeck } from '@/api/types';
import { BrandTag } from '@/components/BrandTag';
import { FadeEdges } from '@/components/FadeEdges';
import { GlowBackground } from '@/components/glow/GlowBackground';
import type { GlowBlob } from '@/components/glow/types';
import { SlideView } from '@/components/SlideView';
import { IconButton, PillButton } from '@/components/ui/Button';
import { PressableScale } from '@/components/ui/PressableScale';
import { Toast, type ToastMessage } from '@/components/ui/Toast';
import type { DeckSlide } from '@/data/clients';
import { downloadDeckPdf, downloadWithToast } from '@/lib/deckPdf';
import { colors, fonts, glow, shadow } from '@/theme/tokens';

const BLOBS: readonly GlowBlob[] = [
  { x: 0.3, y: -0.08, r: 0.62, color: glow.peri, opacity: 0.7 },
  { x: 0.95, y: 0.05, r: 0.42, color: glow.mist },
];

const Separator = () => <View style={{ height: 14 }} />;

/** How often the time spent on each slide is reported (seconds). */
const REPORT_EVERY = 10;

// A slide counts as "on screen" when most of it is visible (must be a stable object for FlatList).
const VIEWABILITY = { itemVisiblePercentThreshold: 60 };

/** Centered message for a link that doesn't exist or was turned off. */
function Notice({ title, body, canBack, loading }: { title: string; body: string; canBack: boolean; loading?: boolean }) {
  const insets = useSafeAreaInsets();
  return (
    <View className="flex-1 bg-canvas" style={{ paddingTop: insets.top + 10 }}>
      <StatusBar style="dark" />
      <GlowBackground blobs={BLOBS} />
      <View className="px-5" style={{ height: 44 }}>
        {canBack ? <IconButton icon={ChevronLeft} label="Back" onPress={() => router.back()} /> : null}
      </View>
      <View className="flex-1 items-center justify-center px-8" style={{ paddingBottom: insets.bottom + 60 }}>
        {loading ? (
          <ActivityIndicator color={colors.brand} size="large" accessibilityLabel="Loading the deck" />
        ) : (
          <>
            <View style={{ width: 96, height: 96, borderRadius: 48, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.card, boxShadow: shadow.card }}>
              <Link2Off size={40} color={colors.muted} strokeWidth={1.6} />
            </View>
            <Text accessibilityRole="header" style={{ fontFamily: fonts.semibold, fontSize: 26, lineHeight: 32, letterSpacing: -0.6, color: colors.ink, marginTop: 24, textAlign: 'center' }}>
              {title}
            </Text>
            <Text className="mt-2 text-center font-jk text-[15px] leading-[22px] text-ink-soft">{body}</Text>
          </>
        )}
      </View>
    </View>
  );
}

type Load = { state: 'loading' } | { state: 'ready'; deck: ApiPublicDeck } | { state: 'missing' } | { state: 'stopped' } | { state: 'error'; message?: string };
type OnViewable = NonNullable<FlatListProps<DeckSlide>['onViewableItemsChanged']>;

/** Device class the API records for this visit (browsers are detected on the server). */
function deviceGuess(width: number): 'phone' | 'tablet' | undefined {
  if (Platform.OS === 'web') return undefined;
  return width >= 768 ? 'tablet' : 'phone';
}

/**
 * The client's view of a shared deck (what opens from https://driveflow.techgylink.com/p/<shareId>), loaded
 * from the public API: no sign-in needed. Each visit is recorded (device, seconds per slide, PDF
 * download) for the sender's activity page; the sender's own previews aren't counted.
 */
export default function SharedDeck() {
  const { slug } = useLocalSearchParams<{ slug?: string }>();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [load, setLoad] = useState<Load>({ state: 'loading' });
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const preview = useCanGoBack();

  // Visit tracking: which slide is on screen, seconds per slide not yet reported, and the visit's token.
  const visit = useRef<{ id: string; token: string } | null>(null);
  const currentSlide = useRef(0);
  const pending = useRef(new Map<number, number>());

  useEffect(() => {
    let alive = true;
    const code = typeof slug === 'string' ? slug : '';
    api<ApiPublicDeck>(`/public/decks/${encodeURIComponent(code)}`)
      .then((deck) => {
        if (!alive) return;
        setLoad({ state: 'ready', deck });
        return api<{ visitId: string | null; token: string | null }>(`/public/decks/${encodeURIComponent(code)}/visits`, {
          method: 'POST',
          body: { device: deviceGuess(width) },
        }).then((v) => {
          if (alive && v.visitId && v.token) visit.current = { id: v.visitId, token: v.token };
        });
      })
      .catch((e) => {
        if (!alive) return;
        if (e instanceof ApiError && e.status === 404) setLoad({ state: 'missing' });
        else if (e instanceof ApiError && e.status === 410) setLoad({ state: 'stopped' });
        else if (e instanceof ApiError && e.code !== 'network') setLoad((l) => (l.state === 'ready' ? l : { state: 'error', message: e.message }));
        else setLoad((l) => (l.state === 'ready' ? l : { state: 'error', message: e instanceof ApiError ? e.message : undefined }));
      });
    return () => {
      alive = false;
    };
    // The device class only matters once, when the visit starts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  const flush = useCallback(() => {
    const v = visit.current;
    if (!v || pending.current.size === 0) return;
    const entries = [...pending.current.entries()].slice(0, 20).map(([slide, seconds]) => ({ slide, seconds: Math.min(60, seconds) }));
    pending.current.clear();
    api(`/public/visits/${v.id}/progress`, { method: 'POST', body: { token: v.token, entries } }).catch(() => undefined);
  }, []);

  // Count a second for the slide on screen while the app is in front; report every few seconds.
  const ready = load.state === 'ready';
  useEffect(() => {
    if (!ready) return;
    let ticks = 0;
    const timer = setInterval(() => {
      if (AppState.currentState !== 'active' || !visit.current) return;
      const s = currentSlide.current;
      pending.current.set(s, (pending.current.get(s) ?? 0) + 1);
      if (++ticks % REPORT_EVERY === 0) flush();
    }, 1000);
    const sub = AppState.addEventListener('change', (st) => st !== 'active' && flush());
    return () => {
      clearInterval(timer);
      sub.remove();
      flush();
    };
  }, [ready, flush]);

  const onViewable = useCallback<OnViewable>(({ viewableItems }) => {
    const first = viewableItems.find((v) => v.isViewable && typeof v.index === 'number');
    if (first?.index != null) currentSlide.current = first.index;
  }, []);

  if (load.state === 'loading') return <Notice title="" body="" canBack={preview} loading />;
  if (load.state === 'missing') return <Notice title="Link not found" body="Check the link, or ask whoever sent it for a new one." canBack={preview} />;
  if (load.state === 'stopped') return <Notice title="This link is no longer active" body="The sender stopped sharing this deck. Ask them for a new link." canBack={preview} />;
  if (load.state === 'error') return <Notice title="Couldn’t open the deck" body={load.message ?? 'Check your connection and try again.'} canBack={preview} />;

  const { deck } = load;
  const slides: DeckSlide[] = deck.slides.map((s) => ({ source: { id: s.url, uri: apiUrl(s.url), kind: null }, title: s.title, missing: s.missing || undefined }));
  const sender = deck.sender;
  const client = deck.client;
  const brand = deck.brand;
  const b = brand.on ? { name: brand.name, accent: brand.accent } : null;
  const from = brand.on ? brand.name : sender.name;
  const pageW = Math.min(width - 32, 720);
  const pageH = Math.round(pageW * (9 / 16));
  // On wide screens (the web link on a laptop) the header and buttons line up with the slide column.
  const sideInset = Math.max(16, (width - pageW) / 2);

  const download = async () => {
    if (busy) return;
    setBusy(true);
    await downloadWithToast(async () => {
      const result = await downloadDeckPdf(client, slides, { deck: deck.title, brand: b, template: deck.template });
      const v = visit.current;
      if (v) api(`/public/visits/${v.id}/download`, { method: 'POST', body: { token: v.token } }).catch(() => undefined);
      return result;
    }, setToast);
    setBusy(false);
  };
  const contact = async () => {
    if (!sender.email) return;
    try {
      await Linking.openURL(`mailto:${sender.email}?subject=${encodeURIComponent(`${client.name} — ${deck.title}`)}`);
    } catch {
      setToast({ message: 'No mail app found', tone: 'error' });
    }
  };

  const renderPage = ({ item, index }: { item: DeckSlide; index: number }) => (
    <View style={{ alignSelf: 'center', borderRadius: 16, boxShadow: shadow.card }} accessible accessibilityLabel={`Slide ${index + 1}: ${item.title}`}>
      <SlideView template={deck.template} source={item.source} title={item.title} eyebrow={client.name} index={index} total={slides.length} brand={b} width={pageW} height={pageH} radius={16} />
    </View>
  );

  const header = (
    <View style={{ width: pageW, alignSelf: 'center', paddingHorizontal: 4, paddingBottom: 22 }}>
      {brand.on ? <BrandTag name={brand.name} accent={brand.accent} /> : <Text className="font-jk-semibold text-[13px] text-muted">Shared via DriveFlow</Text>}
      <Text className="mt-5 font-jk-semibold text-[12px] uppercase tracking-[1.2px] text-muted">Prepared for {client.name}</Text>
      <Text accessibilityRole="header" style={{ fontFamily: fonts.semibold, fontSize: 30, lineHeight: 36, letterSpacing: -0.8, color: colors.ink, marginTop: 4 }}>
        {deck.title}
      </Text>
      <Text className="mt-1.5 font-jk text-[14px] text-ink-soft">
        {deck.type} · {slides.length} slides · from {from}
      </Text>
    </View>
  );

  const showContact = !!sender.email;
  const hasBar = deck.allowPdf || showContact;

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
          onViewableItemsChanged={onViewable}
          viewabilityConfig={VIEWABILITY}
        />
      </FadeEdges>
      {hasBar ? (
        <View className="absolute flex-row gap-3" style={{ left: sideInset, right: sideInset, bottom: insets.bottom + 14 }}>
          {deck.allowPdf ? (
            <PillButton
              label={busy ? 'Preparing…' : 'Save PDF'}
              variant={showContact ? 'secondary' : 'primary'}
              onPress={download}
              disabled={busy}
              flex={1}
              compact
              leading={<Download size={19} color={showContact ? colors.ink : colors.white} strokeWidth={2.2} />}
            />
          ) : null}
          {showContact ? <PillButton label="Contact" onPress={contact} flex={1} compact leading={<Mail size={19} color={colors.white} strokeWidth={2.2} />} /> : null}
        </View>
      ) : null}
      <Toast {...toast} onHide={() => setToast(null)} />
    </View>
  );
}
