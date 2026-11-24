import { router } from 'expo-router';
import { Eye, type LucideIcon, Pencil, Presentation, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { type Deck, deckClient, deleteDeck, renameDeck } from '@/data/app';

import { haptic } from '@/hooks/haptics';
import { errorMessage } from '@/api/client';
import { confirmAction, showError } from '@/lib/confirm';
import { colors, shadow } from '@/theme/tokens';

import { SubmitButton, TextField } from './auth/Form';

function Row({ icon: Icon, label, onPress, danger }: { icon: LucideIcon; label: string; onPress: () => void; danger?: boolean }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} android_ripple={{ color: colors.sky }} style={{ borderRadius: 16, overflow: 'hidden' }}>
      <View style={{ height: 56, flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 12 }}>
        <View style={{ width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: danger ? '#FDECEE' : colors.sky }}>
          <Icon size={18} color={danger ? colors.danger : colors.brand} strokeWidth={2} />
        </View>
        <Text className="font-jk-semibold text-[15px]" style={{ color: danger ? colors.danger : colors.ink }}>
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

/**
 * Bottom sheet with a deck's actions: open, rename, client activity, delete.
 * Give it a `key` of the deck id so it starts fresh for each deck.
 */
export function DeckActions({ deck, onClose }: { deck: Deck | null; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const [renaming, setRenaming] = useState(false);
  const [title, setTitle] = useState(deck?.title ?? '');

  if (!deck) return null;
  const client = deckClient(deck);

  const go = (pathname: '/ready' | '/activity') => {
    onClose();
    router.push({ pathname, params: { deck: deck.id } });
  };

  const remove = () =>
    confirmAction('Delete this deck?', `“${deck.title}” will be removed and its share link will stop working. Your Drive photos are not touched.`, 'Delete', () => {
      deleteDeck(deck.id).catch((e) => showError('Could not delete the deck', errorMessage(e)));
      haptic.warn();
      onClose();
    });

  const save = () => {
    if (!title.trim()) return;
    renameDeck(deck.id, title).catch((e) => showError('Could not rename the deck', errorMessage(e)));
    haptic.success();
    onClose();
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={renaming ? () => setRenaming(false) : onClose} statusBarTranslucent>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(18,21,42,0.38)' }]} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" />
        <View style={{ flex: 1 }} pointerEvents="box-none" />
        <View
          style={{ marginHorizontal: 10, marginBottom: insets.bottom + 10, borderRadius: 28, backgroundColor: colors.canvas, padding: 14, boxShadow: shadow.sheet }}
          accessibilityViewIsModal
        >
          <View className="px-2 pb-2 pt-1">
            <Text className="font-jk-semibold text-[17px] text-ink" numberOfLines={1} accessibilityRole="header">
              {renaming ? 'Rename deck' : deck.title}
            </Text>
            <Text className="mt-0.5 font-jk text-[13px] text-muted" numberOfLines={1}>
              {client.name} · {deck.type} · {deck.slides} slides
            </Text>
          </View>
          {renaming ? (
            <View className="gap-3 px-1 pb-1 pt-2">
              <TextField label="Deck name" value={title} onChangeText={(t) => setTitle(t.slice(0, 60))} autoFocus returnKeyType="done" onSubmitEditing={save} maxLength={60} />
              <View className="flex-row gap-2.5">
                <Pressable
                  onPress={() => {
                    setRenaming(false);
                    setTitle(deck.title);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Cancel"
                  style={{ flex: 1 }}
                >
                  <View style={{ height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.card, borderWidth: 1.5, borderColor: colors.edge }}>
                    <Text className="font-jk-semibold text-[16px] text-ink-soft">Cancel</Text>
                  </View>
                </Pressable>
                <View style={{ flex: 1 }}>
                  <SubmitButton label="Save" loadingLabel="" loading={false} disabled={!title.trim() || title.trim() === deck.title} onPress={save} />
                </View>
              </View>
            </View>
          ) : (
            <View className="pt-1">
              <Row icon={Presentation} label="Open deck" onPress={() => go('/ready')} />
              <Row icon={Pencil} label="Rename" onPress={() => setRenaming(true)} />
              <Row icon={Eye} label="Client activity" onPress={() => go('/activity')} />
              <Row icon={Trash2} label="Delete deck" onPress={remove} danger />
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
