import { router, useLocalSearchParams } from 'expo-router';
import { Check } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, Text, useWindowDimensions, View } from 'react-native';

import { SubmitButton } from '@/components/auth/Form';
import { DeckGone } from '@/components/DeckGone';
import { PageShell } from '@/components/PageShell';
import { SlideView } from '@/components/SlideView';
import { useBrand } from '@/data/brand';
import { buildSlides, coverTitle, useSampleClient } from '@/data/clients';
import { useDeckSlides } from '@/data/deckEdits';
import { getTemplate, setDefaultTemplate, setDeckTemplate, type TemplateId, templates, useDeckTemplate, useDefaultTemplate } from '@/data/templates';
import { haptic } from '@/hooks/haptics';
import { useDeckRoute } from '@/hooks/useDeckRoute';
import { colors, shadow } from '@/theme/tokens';


/**
 * Choose a template. With ?deck=<id> it changes that deck (previews use its own slides);
 * with ?mode=default it sets the template new decks start with (previews use sample slides).
 */
export default function Templates() {
  const params = useLocalSearchParams<{ mode?: string }>();
  const { deck, client: deckClient } = useDeckRoute();
  const forDefault = params.mode === 'default';
  const deckTemplate = useDeckTemplate(deck?.id ?? '');
  const fallback = useDefaultTemplate();
  const active = forDefault ? fallback : deckTemplate;
  const [chosen, setChosen] = useState<TemplateId>(active);
  const deckSlides = useDeckSlides(deck);
  const brand = useBrand();
  const { width } = useWindowDimensions();
  const sample = useSampleClient();

  if (!forDefault && !deck) return <DeckGone title="Templates" />;

  const client = deckClient ?? sample;
  const slides = forDefault ? buildSlides(sample.gallery, 3, coverTitle(sample, 'Portfolio')) : deckSlides;
  const b = brand.on ? { name: brand.name, accent: brand.accent } : null;
  const bigW = width - 32 - 24;
  const smallW = Math.floor((bigW - 8) / 2);
  const picked = getTemplate(chosen);

  const apply = () => {
    if (forDefault) setDefaultTemplate(chosen);
    else if (deck) setDeckTemplate(deck.id, chosen);
    haptic.success();
    router.back();
  };

  const label = chosen === active ? `Using ${picked.name}` : forDefault ? `Make ${picked.name} the default` : `Use ${picked.name}`;

  return (
    <PageShell
      title={forDefault ? 'Default template' : 'Templates'}
      footer={<SubmitButton label={label} loadingLabel="" loading={false} disabled={chosen === active} onPress={apply} />}
    >
      <Text className="mb-3 px-2 font-jk text-[13px] text-muted">
        {forDefault ? 'New decks start with this template. You can still change it for any deck.' : `${deck?.title} · ${client.name} · ${slides.length} slides`}
      </Text>
      <View className="gap-3.5" accessibilityRole="radiogroup">
        {templates.map((t) => {
          const on = t.id === chosen;
          return (
            <Pressable
              key={t.id}
              onPress={() => {
                if (on) return;
                haptic.select();
                setChosen(t.id);
              }}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
              accessibilityLabel={`${t.name} template. ${t.blurb}`}
            >
              <View style={{ borderRadius: 24, padding: 12, backgroundColor: colors.card, borderWidth: 2, borderColor: on ? colors.brand : 'transparent', boxShadow: shadow.soft }}>
                {slides[0] ? <SlideView template={t.id} source={slides[0].source} title={slides[0].title} eyebrow={client.name} index={0} brand={b} width={bigW} radius={14} /> : null}
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                  {slides.slice(1, 3).map((s, i) => (
                    <SlideView key={i} template={t.id} source={s.source} title={s.title} eyebrow={client.name} index={i + 1} total={slides.length} brand={b} width={smallW} radius={10} titleLines={1} />
                  ))}
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 12, paddingHorizontal: 4 }}>
                  <View style={{ flex: 1 }}>
                    <Text className="font-jk-semibold text-[16px] text-ink">
                      {t.name}
                      {t.id === fallback && !forDefault ? <Text className="font-jk text-[13px] text-muted">  · default</Text> : null}
                    </Text>
                    <Text className="mt-0.5 font-jk text-[13px] text-muted">{t.blurb}</Text>
                  </View>
                  <View
                    style={{
                      width: 26,
                      height: 26,
                      borderRadius: 13,
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderWidth: 2,
                      borderColor: on ? colors.brand : colors.edge,
                      backgroundColor: on ? colors.brand : colors.card,
                    }}
                  >
                    {on ? <Check size={15} color={colors.white} strokeWidth={3} /> : null}
                  </View>
                </View>
              </View>
            </Pressable>
          );
        })}
      </View>
    </PageShell>
  );
}
