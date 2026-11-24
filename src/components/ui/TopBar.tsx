import { router } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Text, View } from 'react-native';

import { colors } from '@/theme/tokens';

import { IconButton } from './Button';

type Props = {
  title?: string;
  /** Status line with a green dot (e.g. "Drive synced"). */
  subtitle?: string;
  /** Plain secondary line under the title (e.g. "Proposal · Classic"). */
  caption?: string;
  tag?: string;
  right?: ReactNode;
  onBack?: () => void;
  glass?: boolean;
};

/** Back button · centred title · optional right action. */
export function TopBar({ title, subtitle, caption, tag, right, onBack, glass }: Props) {
  const back = onBack ?? (() => (router.canGoBack() ? router.back() : router.replace('/home')));
  return (
    <View className="h-11 flex-row items-center justify-between">
      <IconButton icon={ChevronLeft} label="Back" onPress={back} glass={glass} />
      <View className="flex-1 items-center px-2">
        {title && (
          <Text className="font-jk-semibold text-[17px] text-ink" numberOfLines={1} accessibilityRole="header">
            {title}
            {tag && <Text className="font-jk text-muted"> ({tag})</Text>}
          </Text>
        )}
        {caption ? (
          <Text className="mt-0.5 font-jk text-[12px] text-muted" numberOfLines={1}>
            {caption}
          </Text>
        ) : null}
        {subtitle && (
          <View className="mt-0.5 flex-row items-center gap-1.5">
            <View className="h-[7px] w-[7px] rounded-full" style={{ backgroundColor: colors.success }} />
            <Text className="font-jk text-[12px] text-muted">{subtitle}</Text>
          </View>
        )}
      </View>
      {right ?? <View className="h-11 w-11" />}
    </View>
  );
}
