import { Image } from 'expo-image';
import { router } from 'expo-router';
import { ChevronRight, Search, X } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';

import { FilterPills, PageShell } from '@/components/PageShell';
import { LoadFailed } from '@/components/LoadFailed';
import { PressableScale } from '@/components/ui/PressableScale';
import { useDecks } from '@/data/app';
import { type Client, loadClients, thumb, useClients, useClientsStatus } from '@/data/clients';
import { colors, shadow } from '@/theme/tokens';

const FILTERS = ['All', 'Villas', 'Towers', 'Communities'] as const;
type Filter = (typeof FILTERS)[number];

function matchesFilter(c: Client, f: Filter) {
  const m = `${c.meta} ${c.name}`.toLowerCase();
  if (f === 'Villas') return m.includes('villa');
  if (f === 'Towers') return m.includes('tower');
  if (f === 'Communities') return m.includes('community') || m.includes('township');
  return true;
}

function ClientRow({ c }: { c: Client }) {
  const last = useDecks().find((d) => d.clientId === c.id);
  return (
    <PressableScale
      onPress={() => router.push({ pathname: '/client/[id]', params: { id: c.id } })}
      scaleTo={0.98}
      accessibilityLabel={`${c.name}, ${c.meta}, ${c.photos} photos. Open client`}
      style={{ borderRadius: 22, backgroundColor: colors.card, boxShadow: shadow.soft, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 12 }}
    >
      <Image source={thumb(c.cover)} style={{ width: 58, height: 58, borderRadius: 16 }} contentFit="cover" accessible={false} />
      <View style={{ flex: 1 }}>
        <Text className="font-jk-semibold text-[16px] text-ink" numberOfLines={1}>
          {c.name}
        </Text>
        <Text className="mt-0.5 font-jk text-[13px] text-muted" numberOfLines={1}>
          {c.meta} · {c.photos} {c.photos === 1 ? 'photo' : 'photos'}
        </Text>
        <Text className="mt-1 font-jk text-[12px] text-brand-deep" numberOfLines={1}>
          {last ? `Last deck: ${last.type.toLowerCase()} · ${last.when}` : 'No decks yet'}
        </Text>
      </View>
      <ChevronRight size={20} color={colors.muted} strokeWidth={2} />
    </PressableScale>
  );
}

/** All clients — search and filter every client linked to Google Drive. */
export default function Clients() {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('All');
  const clients = useClients();
  const status = useClientsStatus();
  const q = query.trim().toLowerCase();
  const list = clients.filter((c) => matchesFilter(c, filter) && (!q || c.name.toLowerCase().includes(q) || c.meta.toLowerCase().includes(q)));

  return (
    <PageShell
      title="All clients"
      header={
        <View className="gap-3">
          <View className="h-[52px] flex-row items-center gap-2.5 rounded-full bg-card pl-[18px] pr-2" style={{ boxShadow: shadow.soft }}>
            <Search size={18} color={colors.muted} strokeWidth={2} />
            <TextInput
              value={query}
              onChangeText={(t) => setQuery(t.slice(0, 60))}
              placeholder="Search clients"
              placeholderTextColor={colors.placeholder}
              autoCorrect={false}
              returnKeyType="search"
              accessibilityLabel="Search clients"
              className="flex-1 font-jk text-[15px] text-ink"
              style={{ paddingVertical: 0, outlineStyle: 'none' } as object}
            />
            {query.length > 0 && (
              <Pressable onPress={() => setQuery('')} hitSlop={10} accessibilityRole="button" accessibilityLabel="Clear search">
                <View style={{ width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.sky }}>
                  <X size={15} color={colors.brand} strokeWidth={2.4} />
                </View>
              </Pressable>
            )}
          </View>
          <FilterPills options={FILTERS} value={filter} onChange={setFilter} />
        </View>
      }
    >
      {(status === 'ready' || clients.length > 0) && (
        <Text className="mb-2 px-2 font-jk text-[13px] text-muted" accessibilityLiveRegion="polite">
          {list.length} {list.length === 1 ? 'client' : 'clients'} · synced from Google Drive
        </Text>
      )}
      {list.length === 0 && status === 'loading' ? (
        <View className="items-center py-10" accessibilityLabel="Loading clients">
          <ActivityIndicator color={colors.brand} />
        </View>
      ) : clients.length === 0 && status === 'error' ? (
        <LoadFailed what="clients" onRetry={loadClients} />
      ) : list.length === 0 && clients.length === 0 ? (
        <View className="items-center rounded-[22px] bg-card px-6 py-10" style={{ boxShadow: shadow.soft }}>
          <Text className="font-jk-semibold text-[16px] text-ink">No clients yet</Text>
          <Text className="mt-1 text-center font-jk text-[13px] text-muted">Connect Google Drive and choose your projects folder in Profile. Each sub-folder becomes a client.</Text>
        </View>
      ) : list.length === 0 ? (
        <View className="items-center rounded-[22px] bg-card px-6 py-10" style={{ boxShadow: shadow.soft }}>
          <Text className="font-jk-semibold text-[16px] text-ink">No clients found</Text>
          <Text className="mt-1 text-center font-jk text-[13px] text-muted">Try another name, or add a client folder in Google Drive.</Text>
        </View>
      ) : (
        <View className="gap-2.5">
          {list.map((c) => (
            <ClientRow key={c.id} c={c} />
          ))}
        </View>
      )}
    </PageShell>
  );
}
