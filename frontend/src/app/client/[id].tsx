import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ChevronLeft, FolderOpen, Plus } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, ScrollView, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PillButton, IconButton } from '@/components/ui/Button';
import { PressableScale } from '@/components/ui/PressableScale';
import { useDecks } from '@/data/app';
import { DeckCard } from '@/components/DeckCard';
import { thumb, useClient, useClientsStatus } from '@/data/clients';
import { PageShell } from '@/components/PageShell';
import { SubmitButton } from '@/components/auth/Form';
import { useSession } from '@/data/session';
import { colors, fonts, shadow } from '@/theme/tokens';
import { FadeEdges } from '@/components/FadeEdges';

/** Client details — Drive photos, past decks and a quick "New deck". */
export default function ClientDetails() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const client = useClient(id);
  const status = useClientsStatus();
  const { drive } = useSession();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const allDecks = useDecks();
  const [pastHero, setPastHero] = useState(false);

  if (!client && (status === 'loading' || status === 'idle')) {
    return (
      <PageShell title="Client">
        <View className="items-center pt-16" accessibilityLabel="Loading client">
          <ActivityIndicator color={colors.brand} />
        </View>
      </PageShell>
    );
  }

  if (!client) {
    return (
      <PageShell title="Client" footer={<SubmitButton label="See all clients" loadingLabel="" loading={false} onPress={() => router.replace('/clients')} />}>
        <View className="items-center pt-12">
          <Text accessibilityRole="header" style={{ fontFamily: fonts.semibold, fontSize: 24, color: colors.ink, textAlign: 'center' }}>
            Client not found
          </Text>
          <Text className="mt-2 px-6 text-center font-jk text-[15px] leading-[22px] text-ink-soft">The link may be old, or the client’s folder was moved in Google Drive.</Text>
        </View>
      </PageShell>
    );
  }

  const heroH = Math.round(Math.min(320, width * 0.78));
  const tile = Math.floor((width - 32 - 16) / 3);
  const clientDecks = allDecks.filter((d) => d.clientId === client.id);
  const folder = `${drive.folder ?? 'Projects'} / ${client.name}`;

  const newDeck = () => router.push({ pathname: '/chat', params: { client: client.id } });
  const allPhotos = () => router.push({ pathname: '/photos', params: { client: client.id } });

  return (
    <View className="flex-1 bg-canvas">
      <StatusBar style={pastHero ? 'dark' : 'light'} />
      <FadeEdges start={0} end={insets.bottom + 96}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 110 }}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={64}
        onScroll={(e) => {
          const past = e.nativeEvent.contentOffset.y > heroH - insets.top - 40;
          if (past !== pastHero) setPastHero(past);
        }}
      >
        {/* Hero */}
        <View style={{ height: heroH }}>
          <Image source={client.cover} style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 }} contentFit="cover" transition={200} accessible={false} />
          <LinearGradient colors={['rgba(20,30,120,0.35)', 'rgba(20,30,120,0)']} style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 120 }} />
          <LinearGradient colors={['rgba(31,55,255,0)', 'rgba(31,55,255,0.8)']} style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: heroH * 0.6 }} />
          <View className="absolute bottom-6 left-5 right-5">
            <Text className="font-jk-semibold text-[12px] uppercase tracking-[1.4px] text-white/90">{client.meta}</Text>
            <Text accessibilityRole="header" style={{ fontFamily: fonts.semibold, fontSize: 32, lineHeight: 38, letterSpacing: -0.8, color: colors.white, marginTop: 2 }}>
              {client.name}
            </Text>
          </View>
        </View>

        {/* Stats */}
        <View className="-mt-4 mx-4 flex-row items-center rounded-3xl bg-card py-4" style={{ boxShadow: shadow.card }}>
          {[
            { v: String(client.photos), k: 'Photos' },
            { v: String(clientDecks.length), k: 'Decks' },
            { v: clientDecks[0]?.when ?? '—', k: 'Last deck' },
          ].map((s) => (
            <View key={s.k} className="flex-1 items-center gap-1">
              <Text className="font-jk-semibold text-[20px] text-ink">{s.v}</Text>
              <Text className="font-jk text-[12px] text-muted">{s.k}</Text>
            </View>
          ))}
        </View>

        <View className="mx-4 mt-3 flex-row items-center gap-2.5 rounded-2xl bg-white/70 px-4 py-3">
          <FolderOpen size={17} color={colors.brand} strokeWidth={1.9} />
          <Text className="flex-1 font-jk text-[13px] text-ink-soft" numberOfLines={1}>
            Google Drive · {folder}
          </Text>
        </View>

        {/* Photos */}
        <View className="mx-4 mb-3 mt-6 flex-row items-center justify-between px-1">
          <Text className="font-jk-semibold text-[18px] text-ink" accessibilityRole="header">
            Photos in Drive
          </Text>
          <PressableScale onPress={allPhotos} accessibilityLabel={`See all ${client.photos} photos`} accessibilityRole="link">
            <Text className="font-jk-semibold text-[14px] text-brand-deep">See all</Text>
          </PressableScale>
        </View>
        <View className="mx-4 flex-row flex-wrap gap-2">
          {client.gallery.slice(0, 6).map((src, i) => (
            <PressableScale key={i} onPress={allPhotos} scaleTo={0.96} accessibilityLabel={`Photo ${i + 1}`}>
              <Image source={thumb(src)} style={{ width: tile, height: tile, borderRadius: 14 }} contentFit="cover" accessible={false} />
            </PressableScale>
          ))}
        </View>

        {/* Decks */}
        <View className="mx-4 mb-3 mt-6 px-1">
          <Text className="font-jk-semibold text-[18px] text-ink" accessibilityRole="header">
            Decks
          </Text>
        </View>
        <View className="mx-4">
          {clientDecks.length === 0 ? (
            <View className="items-center rounded-[22px] bg-card px-6 py-8" style={{ boxShadow: shadow.soft }}>
              <Text className="font-jk-semibold text-[15px] text-ink">No decks yet</Text>
              <Text className="mt-1 text-center font-jk text-[13px] text-muted">Create the first one for {client.name}.</Text>
            </View>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -16 }} contentContainerStyle={{ gap: 10, paddingHorizontal: 16, paddingBottom: 6 }}>
              {clientDecks.map((d) => (
                <DeckCard key={d.id} deck={d} width={clientDecks.length === 1 ? width - 32 : 236} />
              ))}
            </ScrollView>
          )}
        </View>
      </ScrollView>
      </FadeEdges>

      {/* Floating top bar + bottom action */}
      <View className="absolute left-5 right-5 flex-row justify-between" style={{ top: insets.top + 10 }}>
        <IconButton icon={ChevronLeft} label="Back" glass onPress={() => (router.canGoBack() ? router.back() : router.replace('/clients'))} />
      </View>
      <View className="absolute left-4 right-4" style={{ bottom: insets.bottom + 14 }}>
        <PillButton
          label={`New deck for ${client.name}`}
          onPress={newDeck}
          leading={<Plus size={20} color={colors.white} strokeWidth={2.4} />}
        />
      </View>
    </View>
  );
}
