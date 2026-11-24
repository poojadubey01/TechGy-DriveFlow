import type { LucideIcon } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Text, View } from 'react-native';

import { colors, shadow } from '@/theme/tokens';

import { PressableScale } from './PressableScale';

type PillButtonProps = {
  label: string;
  onPress?: () => void;
  variant?: 'primary' | 'secondary';
  leading?: ReactNode;
  disabled?: boolean;
  /** Flex weight when placed in a row. */
  flex?: number;
};

/** Big 60 px pill. Primary = brand blue with a soft blue glow; secondary = white. */
export function PillButton({ label, onPress, variant = 'primary', leading, disabled, flex }: PillButtonProps) {
  const primary = variant === 'primary';
  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled}
      feedback={primary ? 'press' : 'tap'}
      accessibilityLabel={label}
      containerStyle={flex ? { flex } : undefined}
      className={`h-[60px] flex-row items-center justify-center gap-2.5 rounded-full px-6 ${primary ? 'bg-brand' : 'bg-card'}`}
      style={{ boxShadow: primary ? shadow.brand : shadow.card }}
    >
      {leading}
      <Text className={`font-jk-semibold text-[17px] ${primary ? 'text-white' : 'text-ink'}`} numberOfLines={1}>
        {label}
      </Text>
    </PressableScale>
  );
}

type IconButtonProps = {
  icon: LucideIcon;
  label: string;
  onPress?: () => void;
  tint?: string;
  size?: number;
  /** Translucent white, for use over photos. */
  glass?: boolean;
};

/** 44 px white circle with a Lucide icon. */
export function IconButton({ icon: Icon, label, onPress, tint = colors.ink, size = 44, glass }: IconButtonProps) {
  return (
    <PressableScale
      onPress={onPress}
      accessibilityLabel={label}
      scaleTo={0.94}
      className="items-center justify-center rounded-full"
      style={{
        width: size,
        height: size,
        backgroundColor: glass ? 'rgba(255,255,255,0.88)' : colors.card,
        boxShadow: shadow.soft,
      }}
    >
      <Icon size={20} color={tint} strokeWidth={1.9} />
    </PressableScale>
  );
}

/** Small round action with a caption underneath (Home quick actions, share targets). */
export function RoundAction({ icon: Icon, label, onPress }: { icon: LucideIcon; label: string; onPress?: () => void }) {
  return (
    <PressableScale onPress={onPress} accessibilityLabel={label} scaleTo={0.95} className="w-24 items-center gap-2">
      <View
        className="h-[60px] w-[60px] items-center justify-center rounded-full bg-card"
        style={{ boxShadow: shadow.card }}
      >
        <Icon size={21} color={colors.brand} strokeWidth={1.8} />
      </View>
      <Text className="font-jk text-[13px] text-ink-soft">{label}</Text>
    </PressableScale>
  );
}
