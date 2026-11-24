import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { Check } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, Text, useWindowDimensions, View } from 'react-native';

import { SubmitButton } from '@/components/auth/Form';
import { PageShell } from '@/components/PageShell';
import { getClient, MIN_DECK_PHOTOS } from '@/data/clients';
import { deliverPick } from '@/data/photoPick';
import { haptic } from '@/hooks/haptics';
import { colors } from '@/theme/tokens';

/**
 * Photos from the client's Drive folder.
 * mode=pick: tap to select, then "Use N photos" hands the choice back to the chat.
 * Otherwise: a plain gallery.
 */
export default function Photos() {
  const params = useLocalSearchParams<{ client?: string; mode?: string }>();
  const client = getClient(params.client);
  const picking = params.mode === 'pick';
  const { width } = useWindowDimensions();
  const tile = Math.floor((width - 32 - 16) / 3);
  const [selected, setSelected] = useState<Set<number>>(() => new Set());
  const photos = client.gallery;

  const toggle = (i: number) => {
    haptic.select();
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  };

  const allOn = selected.size === photos.length;
  const confirm = () => {
    const chosen = photos.filter((_, i) => selected.has(i));
    deliverPick(chosen);
    haptic.success();
    router.back();
  };

  return (
    <PageShell
      title={picking ? 'Choose photos' : 'Photos'}
      right={
        picking ? (
          <Pressable
            onPress={() => setSelected(allOn ? new Set() : new Set(photos.map((_, i) => i)))}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={allOn ? 'Clear selection' : 'Select all photos'}
            style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
          >
            <Text className="font-jk-semibold text-[13px] text-brand-deep">{allOn ? 'None' : 'All'}</Text>
          </Pressable>
        ) : undefined
      }
      footer={
        picking ? (
          <SubmitButton
            label={
              selected.size >= MIN_DECK_PHOTOS
                ? `Use ${selected.size} photos`
                : selected.size === 0
                  ? `Select at least ${MIN_DECK_PHOTOS} photos`
                  : `Select ${MIN_DECK_PHOTOS - selected.size} more`
            }
            loadingLabel=""
            loading={false}
            disabled={selected.size < MIN_DECK_PHOTOS}
            onPress={confirm}
          />
        ) : undefined
      }
    >
      <Text className="mb-3 px-2 font-jk text-[13px] text-muted">
        {client.name} · {client.photos} photos in Drive · showing the latest {photos.length}
      </Text>
      <View className="flex-row flex-wrap gap-2" accessibilityRole={picking ? 'list' : undefined}>
        {photos.map((src, i) => {
          const on = selected.has(i);
          const order = on ? [...selected].sort((a, b) => a - b).indexOf(i) + 1 : 0;
          return (
            <Pressable
              key={i}
              onPress={picking ? () => toggle(i) : undefined}
              disabled={!picking}
              accessibilityRole={picking ? 'checkbox' : 'image'}
              accessibilityState={picking ? { checked: on } : undefined}
              accessibilityLabel={`Photo ${i + 1}`}
            >
              <View style={{ width: tile, height: tile, borderRadius: 14, overflow: 'hidden', borderWidth: on ? 3 : 0, borderColor: colors.brand }}>
                <Image source={src} style={{ width: '100%', height: '100%' }} contentFit="cover" accessible={false} />
                {picking && (
                  <View
                    style={{
                      position: 'absolute',
                      right: 6,
                      top: 6,
                      width: 24,
                      height: 24,
                      borderRadius: 12,
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderWidth: 2,
                      borderColor: colors.white,
                      backgroundColor: on ? colors.brand : 'rgba(18,21,42,0.25)',
                    }}
                  >
                    {on ? <Text className="font-jk-bold text-[11px] text-white">{order}</Text> : null}
                  </View>
                )}
              </View>
            </Pressable>
          );
        })}
      </View>
      {picking && (
        <View className="mt-4 flex-row items-center gap-2 px-2">
          <Check size={14} color={colors.muted} strokeWidth={2.4} />
          <Text className="font-jk text-[12px] text-muted">Numbers show the order the photos will appear in the deck.</Text>
        </View>
      )}
    </PageShell>
  );
}
