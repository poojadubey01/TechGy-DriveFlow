import { CloudOff, RotateCw } from 'lucide-react-native';
import { Text, View } from 'react-native';

import { PillButton } from '@/components/ui/Button';
import { colors, shadow } from '@/theme/tokens';

type Props = {
  /** What didn't load, as it reads after "your": "decks", "clients", "notifications". */
  what: string;
  /** Loads the list again. While it runs, the screen shows its own loading state. */
  onRetry: () => Promise<unknown>;
};

/** A list that couldn't load (usually no connection): says so and offers to try again. */
export function LoadFailed({ what, onRetry }: Props) {
  return (
    <View className="items-center rounded-[22px] bg-card px-6 py-9" style={{ boxShadow: shadow.soft }} accessibilityLiveRegion="polite">
      <View style={{ width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.sky }}>
        <CloudOff size={26} color={colors.brand} strokeWidth={1.8} />
      </View>
      <Text className="mt-4 font-jk-semibold text-[16px] text-ink">Couldn’t load your {what}</Text>
      <Text className="mt-1 text-center font-jk text-[13px] leading-[19px] text-muted">Check your connection and try again.</Text>
      <View style={{ alignSelf: 'stretch', marginTop: 18 }}>
        <PillButton
          label="Try again"
          onPress={() => void onRetry().catch(() => undefined)}
          leading={<RotateCw size={18} color={colors.white} strokeWidth={2.4} />}
        />
      </View>
    </View>
  );
}
