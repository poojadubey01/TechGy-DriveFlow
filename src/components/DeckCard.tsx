import { router } from 'expo-router';
import { Ellipsis, Eye } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';

import { deckActivity } from '@/data/activity';
import type { Deck } from '@/data/app';
import { useBrand } from '@/data/brand';
import { getClient } from '@/data/clients';
import { useDeckSlides } from '@/data/deckEdits';
import { useDeckTemplate } from '@/data/templates';
import { colors, shadow } from '@/theme/tokens';

import { SlideView } from './SlideView';
import { PressableScale } from './ui/PressableScale';

/**
 * A deck as a card: its real cover in the deck's template, title, details and whether the client
 * has opened it. Used in My decks (grid), Home (recent decks) and Client details.
 * The ••• button sits next to the card (not inside it) so screen readers can reach both.
 */
export function DeckCard({ deck, width, onMore }: { deck: Deck; width: number; onMore?: () => void }) {
  const client = getClient(deck.clientId);
  const template = useDeckTemplate(deck.id);
  const slides = useDeckSlides(deck);
  const brand = useBrand();
  const opens = deckActivity(deck.id, slides.length).visits.length;
  const cover = slides[0];
  const inner = width - 16;
  const narrow = width < 210;

  return (
    <View style={{ width }}>
      <PressableScale
        onPress={() => router.push({ pathname: '/ready', params: { deck: deck.id } })}
        scaleTo={0.97}
        accessibilityLabel={`${deck.title}, ${client.name}. ${deck.type}, ${slides.length} slides, ${deck.when}. ${
          opens ? `Opened ${opens} ${opens === 1 ? 'time' : 'times'}` : 'Not opened yet'
        }`}
        style={{ borderRadius: 20, backgroundColor: colors.card, boxShadow: shadow.soft, padding: 8 }}
      >
        {cover ? (
          <SlideView
            template={template}
            source={cover.source}
            title={cover.title}
            eyebrow={client.name}
            index={0}
            brand={brand.on ? { name: brand.name, accent: brand.accent } : null}
            width={inner}
            radius={13}
            titleLines={1}
          />
        ) : null}
        <View style={{ paddingHorizontal: 6, paddingTop: 10, paddingBottom: 4 }}>
          <Text className="font-jk-semibold text-[15px] text-ink" numberOfLines={2} style={{ minHeight: narrow ? 40 : undefined, lineHeight: 20 }}>
            {deck.title}
          </Text>
          <Text className="mt-0.5 font-jk text-[12px] text-muted" numberOfLines={1}>
            {client.name}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 }}>
            <View style={{ height: 22, paddingHorizontal: 8, borderRadius: 11, justifyContent: 'center', backgroundColor: colors.sky }}>
              <Text className="font-jk-semibold text-[11px] text-brand-deep">{deck.type}</Text>
            </View>
            <Text className="flex-1 font-jk text-[12px] text-muted" numberOfLines={1}>
              {/* Narrow grid cards skip the date (the grid is newest first); wider cards show it. */}
              {narrow ? `${slides.length} slides` : `${slides.length} slides · ${deck.when}`}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 8 }}>
            <Eye size={14} color={opens ? colors.brand : colors.muted} strokeWidth={2.2} />
            <Text className="flex-1 font-jk-medium text-[12px]" style={{ color: opens ? colors.inkSoft : colors.muted }} numberOfLines={1}>
              {opens ? `Opened ${opens}×` : 'Not opened yet'}
            </Text>
          </View>
        </View>
      </PressableScale>
      {onMore ? (
        <Pressable onPress={onMore} hitSlop={8} accessibilityRole="button" accessibilityLabel={`More for ${deck.title}`} style={{ position: 'absolute', right: 14, top: 14 }}>
          <View style={{ width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.92)', boxShadow: shadow.soft }}>
            <Ellipsis size={17} color={colors.ink} strokeWidth={2.2} />
          </View>
        </Pressable>
      ) : null}
    </View>
  );
}
