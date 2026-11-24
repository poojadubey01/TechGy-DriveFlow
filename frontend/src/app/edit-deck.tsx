import { Image } from 'expo-image';
import { router } from 'expo-router';
import { ArrowDown, ArrowUp, type LucideIcon, RotateCcw, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { SubmitButton } from '@/components/auth/Form';
import { DeckGone } from '@/components/DeckGone';
import { PageShell } from '@/components/PageShell';
import { IconButton } from '@/components/ui/Button';
import { renameDeck, setDeckSlides } from '@/data/app';
import type { DeckSlide } from '@/data/clients';
import { builtSlides, saveDeck, useDeckSlides } from '@/data/deckEdits';
import { haptic } from '@/hooks/haptics';
import { useDeckRoute } from '@/hooks/useDeckRoute';
import { confirmAction } from '@/lib/confirm';
import { colors, fonts, shadow } from '@/theme/tokens';

const MIN_SLIDES = 3;

/** A slide being edited, with a stable id so inputs keep focus while typing and reordering. */
type Item = DeckSlide & { uid: number };
const withIds = (slides: DeckSlide[]): Item[] => slides.map((s, i) => ({ ...s, uid: i }));

function SmallButton({ icon: Icon, label, onPress, disabled, tint = colors.brand }: { icon: LucideIcon; label: string; onPress: () => void; disabled?: boolean; tint?: string }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} hitSlop={4} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled: !!disabled }}>
      <View style={{ width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.sky, opacity: disabled ? 0.35 : 1 }}>
        <Icon size={17} color={tint} strokeWidth={2.2} />
      </View>
    </Pressable>
  );
}

/**
 * Edit deck — rename, reorder and remove slides. The first slide's title is the deck's name.
 * Nothing changes until Save; then Ready, Preview, the PDF, the client view and My decks follow.
 */
export default function EditDeck() {
  const { deck } = useDeckRoute();
  const current = useDeckSlides(deck);
  const [draft, setDraft] = useState<Item[]>(() => withIds(current));
  const [dirty, setDirty] = useState(false);

  if (!deck) return <DeckGone title="Edit deck" />;

  const update = (next: Item[]) => {
    setDraft(next);
    setDirty(true);
  };
  const move = (i: number, by: -1 | 1) => {
    const j = i + by;
    if (j < 0 || j >= draft.length) return;
    haptic.select();
    const next = [...draft];
    [next[i], next[j]] = [next[j]!, next[i]!];
    update(next);
  };
  const remove = (i: number) => {
    if (draft.length <= MIN_SLIDES) return;
    haptic.tap();
    update(draft.filter((_, k) => k !== i));
  };
  const rename = (i: number, title: string) => update(draft.map((s, k) => (k === i ? { ...s, title: title.replace(/\s*\n\s*/g, ' ').slice(0, 60) } : s)));

  const save = () => {
    // An emptied title falls back to that slide's title from before this edit.
    const slides = draft.map(({ uid, ...s }) => ({ ...s, title: s.title.trim() || current[uid]?.title || deck.title }));
    saveDeck(deck.id, slides);
    setDeckSlides(deck.id, slides.length);
    renameDeck(deck.id, slides[0]!.title);
    haptic.success();
    router.back();
  };

  // Goes back to the deck as it was built (its photos and slide count). Applied on Save.
  const reset = () =>
    confirmAction('Reset this deck?', 'Slide order, titles and removed slides go back to how the deck was built. Nothing changes until you save.', 'Reset', () => {
      setDraft(withIds(builtSlides(deck)));
      setDirty(true);
      haptic.select();
    });

  return (
    <PageShell
      title="Edit deck"
      right={<IconButton icon={RotateCcw} label="Reset to as built" tint={colors.inkSoft} onPress={reset} />}
      footer={<SubmitButton label={dirty ? 'Save changes' : 'No changes'} loadingLabel="" loading={false} disabled={!dirty} onPress={save} />}
    >
      <Text className="mb-3 px-2 font-jk text-[13px] text-muted">
        {deck.type} · {draft.length} slides · the first title is the deck’s name
      </Text>
      <View className="gap-2.5">
        {draft.map((s, i) => (
          <View key={s.uid} style={{ borderRadius: 20, backgroundColor: colors.card, boxShadow: shadow.soft, padding: 10, flexDirection: 'row', gap: 10 }}>
            <View style={{ width: 96, height: 54, borderRadius: 10, overflow: 'hidden' }}>
              <Image source={s.source} style={{ width: '100%', height: '100%' }} contentFit="cover" accessible={false} />
              <View style={{ position: 'absolute', left: 4, top: 4, minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 5, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(18,21,42,0.55)' }}>
                <Text className="font-jk-bold text-[11px] text-white">{i + 1}</Text>
              </View>
            </View>
            <View style={{ flex: 1, gap: 8 }}>
              <TextInput
                value={s.title}
                onChangeText={(t) => rename(i, t)}
                placeholder="Slide title"
                placeholderTextColor={colors.placeholder}
                accessibilityLabel={i === 0 ? 'Slide 1 title, the deck name' : `Slide ${i + 1} title`}
                returnKeyType="done"
                // Wraps long titles instead of scrolling them out of view; Enter closes the keyboard.
                multiline
                submitBehavior="blurAndSubmit"
                maxLength={60}
                textAlignVertical="top"
                style={[{ fontFamily: fonts.semibold, fontSize: 14, lineHeight: 19, color: colors.ink, paddingVertical: 8, paddingHorizontal: 10, borderRadius: 12, backgroundColor: colors.canvas }, { outlineStyle: 'none' } as object]}
              />
              <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8 }}>
                <SmallButton icon={ArrowUp} label={`Move slide ${i + 1} up`} onPress={() => move(i, -1)} disabled={i === 0} />
                <SmallButton icon={ArrowDown} label={`Move slide ${i + 1} down`} onPress={() => move(i, 1)} disabled={i === draft.length - 1} />
                <SmallButton icon={Trash2} label={`Remove slide ${i + 1}`} onPress={() => remove(i)} disabled={draft.length <= MIN_SLIDES} tint={colors.danger} />
              </View>
            </View>
          </View>
        ))}
      </View>
      <Text className="mt-4 px-2 text-center font-jk text-[12px] text-muted">A deck keeps at least {MIN_SLIDES} slides.</Text>
    </PageShell>
  );
}
