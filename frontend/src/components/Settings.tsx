import { ChevronRight, type LucideIcon } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Text, View } from 'react-native';

import { colors, shadow } from '@/theme/tokens';

import { PressableScale } from './ui/PressableScale';

/** White rounded card that groups settings rows. */
export function SettingsCard({ children }: { children: ReactNode }) {
  return <View style={{ borderRadius: 22, backgroundColor: colors.card, boxShadow: shadow.soft, paddingHorizontal: 16 }}>{children}</View>;
}

type RowProps = {
  icon?: LucideIcon;
  title: string;
  detail?: string;
  right?: ReactNode;
  last?: boolean;
  /** Makes the row tappable and adds a chevron (unless `right` is given). */
  onPress?: () => void;
  tone?: 'default' | 'danger';
  accessibilityLabel?: string;
};

/** Settings row: optional round icon, title + detail, and a control or chevron on the right. */
export function SettingsRow({ icon: Icon, title, detail, right, last, onPress, tone = 'default', accessibilityLabel }: RowProps) {
  const danger = tone === 'danger';
  const body = (
    <View style={{ minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: last ? 0 : 1, borderBottomColor: colors.line }}>
      {Icon && (
        <View style={{ width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: danger ? '#FDECEE' : colors.sky }}>
          <Icon size={18} color={danger ? colors.danger : colors.brand} strokeWidth={1.9} />
        </View>
      )}
      <View style={{ flex: 1 }}>
        <Text className="font-jk-semibold text-[15px]" style={{ color: danger ? colors.danger : colors.ink }}>
          {title}
        </Text>
        {detail ? <Text className="mt-0.5 font-jk text-[13px] text-muted">{detail}</Text> : null}
      </View>
      {right ?? (onPress ? <ChevronRight size={18} color={colors.muted} strokeWidth={2} /> : null)}
    </View>
  );
  if (!onPress) return body;
  return (
    <PressableScale onPress={onPress} scaleTo={0.98} accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? title}>
      {body}
    </PressableScale>
  );
}

/** Shown on account pages when nobody is signed in (e.g. an old deep link). */
export function SignInRequired({ onSignIn }: { onSignIn: () => void }) {
  return (
    <View className="items-center rounded-[22px] bg-card px-6 py-8" style={{ boxShadow: shadow.soft }}>
      <Text className="font-jk-semibold text-[16px] text-ink">You’re signed out</Text>
      <Text className="mt-1 text-center font-jk text-[13px] leading-[19px] text-muted">Sign in to manage your account.</Text>
      <PressableScale
        onPress={onSignIn}
        accessibilityLabel="Go to sign in"
        containerStyle={{ marginTop: 16 }}
        style={{ height: 44, paddingHorizontal: 20, borderRadius: 22, justifyContent: 'center', backgroundColor: colors.brand }}
      >
        <Text className="font-jk-semibold text-[14px] text-white">Go to sign in</Text>
      </PressableScale>
    </View>
  );
}
