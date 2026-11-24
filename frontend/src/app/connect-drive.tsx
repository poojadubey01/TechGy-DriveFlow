import { Image } from 'expo-image';
import { router, useCanGoBack, useLocalSearchParams } from 'expo-router';
import { Check, HardDrive, type LucideIcon, ShieldCheck, Unplug, Eye } from 'lucide-react-native';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { AuthShell } from '@/components/auth/AuthShell';
import { StepDots, SubmitButton, TextLink } from '@/components/auth/Form';
import { setDrive, useSession } from '@/data/session';
import { haptic } from '@/hooks/haptics';
import { useMounted } from '@/hooks/useMounted';
import { resetTo } from '@/lib/nav';
import { connectDrive } from '@/services/drive';
import { colors, shadow } from '@/theme/tokens';

const logo = require('../../assets/images/logo-blue.png');

const POINTS: { icon: LucideIcon; title: string; body: string }[] = [
  { icon: Eye, title: 'Reads only the folder you choose', body: 'DriveFlow looks at project photos, nothing else.' },
  { icon: ShieldCheck, title: 'Never edits or deletes files', body: 'Read-only access. Your Drive stays exactly as it is.' },
  { icon: Unplug, title: 'Disconnect any time', body: 'Turn it off in Profile and access is removed.' },
];

/** Onboarding 1/3 — connect Google Drive (read-only). */
export default function ConnectDrive() {
  const { from } = useLocalSearchParams<{ from?: string }>();
  const fromProfile = from === 'profile';
  const { user } = useSession();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mounted = useMounted();
  const canGoBack = useCanGoBack();

  const connect = async () => {
    setError(null);
    setLoading(true);
    try {
      const { account } = await connectDrive(user?.email);
      if (!mounted.current) return;
      setDrive({ connected: true, account });
      haptic.success();
      router.push({ pathname: '/choose-folder', params: fromProfile ? { from: 'profile' } : {} });
    } catch {
      setError('Could not connect to Google Drive. Check your connection and try again.');
      haptic.warn();
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      noBack={!fromProfile && !canGoBack}
      eyebrow={fromProfile ? undefined : <StepDots step={1} />}
      title="Connect Google Drive"
      subtitle="DriveFlow builds decks from the project photos you already keep in Drive."
      footer={
        <View className="gap-2">
          <SubmitButton label="Connect Google Drive" loadingLabel="Connecting…" loading={loading} onPress={connect} />
          {!fromProfile && (
            <View className="items-center">
              <TextLink label="Skip for now" muted onPress={() => !loading && resetTo('/home')} />
            </View>
          )}
        </View>
      }
    >
      {/* DriveFlow ↔ Drive */}
      <View className="flex-row items-center justify-center" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <View style={{ width: 76, height: 76, borderRadius: 26, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.card, boxShadow: shadow.card }}>
          <Image source={logo} style={{ width: 40, height: 40 }} contentFit="contain" />
        </View>
        <View className="mx-3 flex-row items-center gap-1.5">
          {[0, 1, 2].map((i) => (
            <View key={i} style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.lav }} />
          ))}
          <View style={{ width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.brand }}>
            <Check size={16} color={colors.white} strokeWidth={3} />
          </View>
          {[0, 1, 2].map((i) => (
            <View key={i} style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.lav }} />
          ))}
        </View>
        <View style={{ width: 76, height: 76, borderRadius: 26, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.card, boxShadow: shadow.card }}>
          <HardDrive size={34} color={colors.brand} strokeWidth={1.6} />
        </View>
      </View>

      <View className="mt-8 gap-3">
        {POINTS.map(({ icon: Icon, title, body }) => (
          <View key={title} style={{ flexDirection: 'row', gap: 12, padding: 14, borderRadius: 20, backgroundColor: colors.card, boxShadow: shadow.soft }}>
            <View style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.sky }}>
              <Icon size={19} color={colors.brand} strokeWidth={1.9} />
            </View>
            <View style={{ flex: 1 }}>
              <Text className="font-jk-semibold text-[15px] text-ink">{title}</Text>
              <Text className="mt-0.5 font-jk text-[13px] leading-[18px] text-muted">{body}</Text>
            </View>
          </View>
        ))}
      </View>

      {error ? (
        <Text className="mt-4 text-center font-jk-medium text-[13px]" style={{ color: colors.danger }} accessibilityLiveRegion="assertive">
          {error}
        </Text>
      ) : null}
    </AuthShell>
  );
}
