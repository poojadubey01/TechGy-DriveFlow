import { router } from 'expo-router';
import { FileX } from 'lucide-react-native';
import { Text, View } from 'react-native';

import { colors, fonts, shadow } from '@/theme/tokens';

import { SubmitButton } from './auth/Form';
import { PageShell } from './PageShell';

/** Shown on deck screens when the deck no longer exists (deleted) or the link is wrong. */
export function DeckGone({ title = 'Deck' }: { title?: string }) {
  return (
    <PageShell title={title} footer={<SubmitButton label="Go to My decks" loadingLabel="" loading={false} onPress={() => router.replace('/decks')} />}>
      <View className="items-center pt-12">
        <View style={{ width: 96, height: 96, borderRadius: 48, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.card, boxShadow: shadow.card }}>
          <FileX size={40} color={colors.muted} strokeWidth={1.6} />
        </View>
        <Text accessibilityRole="header" style={{ fontFamily: fonts.semibold, fontSize: 24, lineHeight: 30, color: colors.ink, marginTop: 24, textAlign: 'center' }}>
          This deck isn’t here any more
        </Text>
        <Text className="mt-2 px-6 text-center font-jk text-[15px] leading-[22px] text-ink-soft">It may have been deleted. Your other decks are in My decks.</Text>
      </View>
    </PageShell>
  );
}
