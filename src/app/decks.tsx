import { router } from 'expo-router';
import { LayoutGrid, Plus } from 'lucide-react-native';
import { useState } from 'react';
import { Text, useWindowDimensions, View } from 'react-native';

import { DeckActions } from '@/components/DeckActions';
import { DeckCard } from '@/components/DeckCard';
import { FilterPills, PageShell } from '@/components/PageShell';
import { IconButton, PillButton } from '@/components/ui/Button';
import { type Deck, useDecks } from '@/data/app';
import { colors, shadow } from '@/theme/tokens';

const FILTERS = ['All', 'Portfolio', 'Proposal', 'Moodboard'] as const;
type Filter = (typeof FILTERS)[number];

/** My decks — every deck as a cover card in its template, with open / rename / activity / delete. */
export default function Decks() {
  const [filter, setFilter] = useState<Filter>('All');
  const [menuFor, setMenuFor] = useState<Deck | null>(null);
  const all = useDecks();
  const list = all.filter((d) => filter === 'All' || d.type === filter);
  const { width } = useWindowDimensions();
  const cardW = Math.floor((width - 32 - 10) / 2);

  return (
    <>
      <PageShell
        title="My decks"
        right={<IconButton icon={Plus} label="New deck" tint={colors.brand} onPress={() => router.push('/chat')} />}
        header={<FilterPills options={FILTERS} value={filter} onChange={setFilter} />}
      >
        <Text className="mb-2.5 px-2 font-jk text-[13px] text-muted" accessibilityLiveRegion="polite">
          {list.length} {list.length === 1 ? 'deck' : 'decks'}
          {filter === 'All' ? '' : ` · ${filter.toLowerCase()}s`}
        </Text>
        {list.length === 0 ? (
          <View className="items-center rounded-[22px] bg-card px-6 py-9" style={{ boxShadow: shadow.soft }}>
            <View style={{ width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.sky }}>
              <LayoutGrid size={26} color={colors.brand} strokeWidth={1.8} />
            </View>
            <Text className="mt-4 font-jk-semibold text-[16px] text-ink">{all.length === 0 ? 'No decks yet' : `No ${filter.toLowerCase()}s yet`}</Text>
            <Text className="mt-1 text-center font-jk text-[13px] leading-[19px] text-muted">Tag a client in the chat and DriveFlow builds one from their Drive photos.</Text>
            <View style={{ alignSelf: 'stretch', marginTop: 18 }}>
              <PillButton label="New deck" onPress={() => router.push('/chat')} leading={<Plus size={20} color={colors.white} strokeWidth={2.4} />} />
            </View>
          </View>
        ) : (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            {list.map((d) => (
              <DeckCard key={d.id} deck={d} width={cardW} onMore={() => setMenuFor(d)} />
            ))}
          </View>
        )}
      </PageShell>
      <DeckActions key={menuFor?.id ?? 'none'} deck={menuFor} onClose={() => setMenuFor(null)} />
    </>
  );
}
