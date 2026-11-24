import { router } from 'expo-router';
import { Download, Eye, Laptop, type LucideIcon, Smartphone, Tablet } from 'lucide-react-native';
import { ActivityIndicator, Text, View } from 'react-native';

import { DeckGone } from '@/components/DeckGone';
import { PageShell, SectionLabel } from '@/components/PageShell';
import { SettingsCard } from '@/components/Settings';
import { SlideView } from '@/components/SlideView';
import { PillButton } from '@/components/ui/Button';
import { type Device, formatDuration, useDeckActivity } from '@/data/activity';
import { useBrand } from '@/data/brand';
import { useDeckSlides } from '@/data/deckEdits';
import { useDeckTemplate } from '@/data/templates';
import { useDeckRoute } from '@/hooks/useDeckRoute';
import { colors, fonts, shadow } from '@/theme/tokens';

const DEVICE: Record<Device, { icon: LucideIcon; label: string }> = {
  phone: { icon: Smartphone, label: 'Phone' },
  laptop: { icon: Laptop, label: 'Laptop' },
  tablet: { icon: Tablet, label: 'Tablet' },
};

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', gap: 4, paddingVertical: 16 }}>
      <Text style={{ fontFamily: fonts.semibold, fontSize: 22, letterSpacing: -0.4, color: colors.ink }} numberOfLines={1}>
        {value}
      </Text>
      <Text className="font-jk text-[12px] text-muted">{label}</Text>
    </View>
  );
}

/** Client activity — when the client opened the share link, from what, and which slides held their attention. */
export default function Activity() {
  const { deck, client } = useDeckRoute();
  const slides = useDeckSlides(deck);
  const template = useDeckTemplate(deck?.id ?? '');
  const brand = useBrand();
  const { data: a, loading, error, reload } = useDeckActivity(deck?.id);

  if (!deck || !client) return <DeckGone title="Client activity" />;

  const b = brand.on ? { name: brand.name, accent: brand.accent } : null;
  const max = Math.max(1, ...a.perSlide);
  const top = a.perSlide.indexOf(max);

  const openDeck = () => router.replace({ pathname: '/ready', params: { deck: deck.id } });

  return (
    <PageShell title="Client activity">
      <Text className="mb-3 px-2 font-jk text-[13px] text-muted" numberOfLines={1}>
        {client.name} · {deck.title}
      </Text>

      {loading && a.visits.length === 0 ? (
        <View className="items-center py-12" accessibilityLabel="Loading client activity">
          <ActivityIndicator color={colors.brand} />
        </View>
      ) : error && a.visits.length === 0 ? (
        <View className="items-center rounded-[22px] bg-card px-6 py-8" style={{ boxShadow: shadow.soft }}>
          <Text className="text-center font-jk-medium text-[14px]" style={{ color: colors.danger }}>
            {error}
          </Text>
          <View style={{ alignSelf: 'stretch', marginTop: 16 }}>
            <PillButton label="Try again" variant="secondary" onPress={reload} />
          </View>
        </View>
      ) : a.visits.length === 0 ? (
        <View className="items-center rounded-[22px] bg-card px-6 py-8" style={{ boxShadow: shadow.soft }}>
          <View style={{ width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.sky }}>
            <Eye size={28} color={colors.brand} strokeWidth={1.8} />
          </View>
          <Text className="mt-4 font-jk-semibold text-[17px] text-ink">Not opened yet</Text>
          <Text className="mt-1.5 text-center font-jk text-[14px] leading-[21px] text-muted">
            When {client.name} opens your share link, you’ll see each visit here and which slides they spent time on.
          </Text>
          <View style={{ alignSelf: 'stretch', marginTop: 20 }}>
            <PillButton label="Open the deck" variant="secondary" onPress={openDeck} />
          </View>
        </View>
      ) : (
        <>
          <View className="flex-row rounded-[22px] bg-card" style={{ boxShadow: shadow.soft }}>
            <Stat value={String(a.visits.length)} label={a.visits.length === 1 ? 'Open' : 'Opens'} />
            <View style={{ width: 1, marginVertical: 14, backgroundColor: colors.line }} />
            <Stat value={formatDuration(a.totalSeconds)} label="Time spent" />
            <View style={{ width: 1, marginVertical: 14, backgroundColor: colors.line }} />
            <Stat value={a.visits[0]!.when.split(',')[0]!} label="Last opened" />
          </View>
          {a.downloads > 0 ? (
            <View className="mt-3 flex-row items-center gap-2 px-2">
              <Download size={15} color={colors.brand} strokeWidth={2.2} />
              <Text className="font-jk text-[13px] text-ink-soft">
                Downloaded the PDF {a.downloads === 1 ? 'once' : `${a.downloads} times`}
              </Text>
            </View>
          ) : null}

          <SectionLabel text="Time on each slide" />
          <SettingsCard>
            {slides.map((s, i) => {
              const secs = a.perSlide[i] ?? 0;
              return (
                <View
                  key={i}
                  accessible
                  accessibilityLabel={`Slide ${i + 1}, ${s.title}: ${formatDuration(secs)}${i === top ? ', most viewed' : ''}`}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: i === slides.length - 1 ? 0 : 1, borderBottomColor: colors.line }}
                >
                  <SlideView template={template} source={s.source} title={s.title} eyebrow={client.name} index={i} brand={b} width={72} radius={7} titleLines={1} />
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text className="flex-1 font-jk-medium text-[13px] text-ink" numberOfLines={1}>
                        {i + 1}. {s.title}
                      </Text>
                      <Text className="font-jk-semibold text-[12px] text-ink-soft" style={{ fontVariant: ['tabular-nums'] }}>
                        {formatDuration(secs)}
                      </Text>
                    </View>
                    {/* Track + bar: one series, one hue; the value is in the text next to it. */}
                    <View style={{ height: 6, borderRadius: 3, marginTop: 7, backgroundColor: colors.sky, overflow: 'hidden' }}>
                      <View style={{ height: 6, borderRadius: 3, width: `${Math.max(3, (secs / max) * 100)}%`, backgroundColor: colors.brand }} />
                    </View>
                    {i === top ? <Text className="mt-1.5 font-jk-semibold text-[11px] text-brand-deep">Most viewed</Text> : null}
                  </View>
                </View>
              );
            })}
          </SettingsCard>

          <SectionLabel text="Visits" />
          <SettingsCard>
            {a.visits.map((v, i) => {
              const d = DEVICE[v.device];
              return (
                <View
                  key={i}
                  style={{ minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: i === a.visits.length - 1 ? 0 : 1, borderBottomColor: colors.line }}
                >
                  <View style={{ width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.sky }}>
                    <d.icon size={17} color={colors.brand} strokeWidth={1.9} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text className="font-jk-semibold text-[14px] text-ink">{v.when}</Text>
                    <Text className="mt-0.5 font-jk text-[12px] text-muted">
                      {d.label}
                      {v.downloaded ? ' · downloaded the PDF' : ''}
                    </Text>
                  </View>
                  <Text className="font-jk-semibold text-[13px] text-ink-soft" style={{ fontVariant: ['tabular-nums'] }}>
                    {formatDuration(v.seconds)}
                  </Text>
                </View>
              );
            })}
          </SettingsCard>
          <Text className="mt-3 px-2 text-center font-jk text-[12px] leading-[18px] text-muted">
            Counted when {client.name} opens the share link. Your own previews don’t count.
          </Text>
        </>
      )}
    </PageShell>
  );
}
