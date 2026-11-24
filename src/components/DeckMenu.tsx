import { Download, Ellipsis, LayoutTemplate, type LucideIcon, Pencil, Share2 } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut, ReduceMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, shadow } from '@/theme/tokens';

import { IconButton } from './ui/Button';

type Props = {
  /** Builds and shares the PDF; call `ready()` once the file exists so the menu can close. */
  onDownload: (ready: () => void) => Promise<void> | void;
  onShare: () => void;
  /** Opens the deck editor (reorder, rename, remove slides). */
  onEdit?: () => void;
  /** Opens the template picker for this deck. */
  onTemplate?: () => void;
  /** Translucent button, for use over photos. */
  glass?: boolean;
};

function Row({ icon: Icon, label, hint, onPress, busy }: { icon: LucideIcon; label: string; hint: string; onPress: () => void; busy?: boolean }) {
  // Static styles only: on Android, NativeWind drops a Pressable style *function*.
  return (
    <Pressable onPress={onPress} disabled={busy} accessibilityRole="menuitem" accessibilityLabel={label} android_ripple={{ color: colors.sky }} style={{ borderRadius: 16, overflow: 'hidden' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, height: 58 }}>
        <View style={{ width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.sky }}>
          {busy ? <ActivityIndicator size="small" color={colors.brand} /> : <Icon size={18} color={colors.brand} strokeWidth={2} />}
        </View>
        <View style={{ flex: 1 }}>
          <Text className="font-jk-semibold text-[15px] text-ink">{label}</Text>
          <Text className="font-jk text-[12px] text-muted">{hint}</Text>
        </View>
      </View>
    </Pressable>
  );
}

/** The ••• button: a small menu anchored top-right with Edit deck, Change template, Download PDF and Share. */
export function DeckMenu({ onDownload, onShare, onEdit, onTemplate, glass }: Props) {
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const download = async () => {
    setBusy(true);
    const close = () => {
      setBusy(false);
      setOpen(false);
    };
    try {
      await onDownload(close);
    } finally {
      setBusy(false);
      setOpen(false);
    }
  };

  return (
    <>
      <IconButton icon={Ellipsis} label="More options" glass={glass} onPress={() => setOpen(true)} />
      <Modal visible={open} transparent animationType="none" statusBarTranslucent navigationBarTranslucent onRequestClose={() => {
          if (!busy) setOpen(false);
        }}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => {
          if (!busy) setOpen(false);
        }} accessibilityLabel="Close menu" />
        <Animated.View
          entering={FadeIn.duration(140).reduceMotion(ReduceMotion.System)}
          exiting={FadeOut.duration(120).reduceMotion(ReduceMotion.System)}
          style={{ position: 'absolute', right: 16, top: insets.top + 62 }}
        >
          <View style={{ width: 244, borderRadius: 22, backgroundColor: colors.card, padding: 6, boxShadow: shadow.lift }} accessibilityRole="menu">
            {onEdit && (
              <Row
                icon={Pencil}
                label="Edit deck"
                hint="Reorder, rename or remove slides"
                busy={false}
                onPress={() => {
                  setOpen(false);
                  onEdit();
                }}
              />
            )}
            {onTemplate && (
              <Row
                icon={LayoutTemplate}
                label="Change template"
                hint="Pick a different look for every slide"
                busy={false}
                onPress={() => {
                  setOpen(false);
                  onTemplate();
                }}
              />
            )}
            <Row icon={Download} label={busy ? 'Preparing PDF…' : 'Download PDF'} hint="Save the deck to your phone" onPress={download} busy={busy} />
            <Row
              icon={Share2}
              label="Share"
              hint="Send the link to the client"
              busy={false}
              onPress={() => {
                setOpen(false);
                onShare();
              }}
            />
          </View>
        </Animated.View>
      </Modal>
    </>
  );
}
